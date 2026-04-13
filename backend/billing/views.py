# backend/billing/views.py
import uuid
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from django.shortcuts import get_object_or_404, redirect

from rest_framework.views import APIView
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import BillingConfig, BillingProduct, Invoice, Transaction, DiscountCode, FAQ
from .serializers import (
    BillingConfigSerializer, 
    BillingProductSerializer, 
    TransactionSerializer, 
    InvoiceSerializer, FAQSerializer
)
from .services import FulfillmentService
from .gateways.zarinpal import ZarinPalGateway
from users.eligibility import is_user_eligible_for_plan

logger = logging.getLogger(__name__)

# --- CONFIGURATION ---

class BillingConfigView(APIView):
    """
    Public endpoint to bootstrap frontend economy settings (Currency name, Free tier limits).
    """
    permission_classes = [AllowAny] 

    def get(self, request):
        config = BillingConfig.load()
        serializer = BillingConfigSerializer(config)
        return Response(serializer.data)

# --- STOREFRONT ---

class ProductListView(generics.ListAPIView):
    """
    Lists available products (Both Top-ups and Plans).
    The serializer includes nested 'plan_details' if it's a plan product.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = BillingProductSerializer
    queryset = BillingProduct.objects.none()

    def get_queryset(self):
        products = BillingProduct.objects.filter(is_active=True).select_related("linked_plan").order_by("price")
        user = self.request.user
        visible_ids = []
        for product in products:
            if not product.linked_plan:
                visible_ids.append(product.id)
                continue
            if is_user_eligible_for_plan(user, product.linked_plan):
                visible_ids.append(product.id)
        return BillingProduct.objects.filter(id__in=visible_ids).select_related("linked_plan").order_by("price")

class TransactionHistoryView(generics.ListAPIView):
    """
    Returns unified history. Uses 'type' query param to switch between Invoices and Wallet Log.
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.query_params.get('type') == 'invoice':
            return InvoiceSerializer
        return TransactionSerializer
    
    def get_queryset(self):
        if self.request.query_params.get('type') == 'invoice':
            return Invoice.objects.filter(user=self.request.user).order_by('-created_at')
        # Return only Spending/Deposit history from Wallet transactions
        return Transaction.objects.filter(wallet__user=self.request.user).order_by('-timestamp')

# --- PURCHASE FLOW ---

class PurchaseDirectView(APIView):
    """
    Creates an Invoice for a BillingProduct (Plan or Credit Pack).
    Payload: { "id": 123 }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        item_id = request.data.get('id')

        if not item_id:
            return Response({"error": "Product ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = BillingProduct.objects.get(pk=item_id, is_active=True)
        except BillingProduct.DoesNotExist:
            return Response({"error": "Product not found or inactive"}, status=status.HTTP_404_NOT_FOUND)

        if product.linked_plan and not is_user_eligible_for_plan(request.user, product.linked_plan):
            return Response({"error": "You are not eligible to purchase this plan."}, status=status.HTTP_403_FORBIDDEN)

        try:
            with transaction.atomic():
                # Create a PENDING Invoice
                invoice = Invoice.objects.create(
                    user=request.user,
                    status=Invoice.Status.PENDING,
                    total_amount=product.price,
                    content_object=product
                )
                
                return Response({
                    "invoice_id": invoice.id,
                    "status": "created",
                    "redirect_url": f"/dashboard/invoices/{invoice.id}"
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Purchase Error: {e}")
            return Response({"error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class InvoiceDetailView(generics.RetrieveAPIView):
    """
    Retrieves a single invoice for the checkout/detail page.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return Invoice.objects.filter(user=self.request.user)

class ApplyDiscountView(APIView):
    """
    Applies a discount code to a PENDING invoice.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        invoice = get_object_or_404(Invoice, id=invoice_id, user=request.user)
        code_str = request.data.get('code')

        if not code_str:
            return Response({"error": "Discount code is required."}, status=status.HTTP_400_BAD_REQUEST)

        if invoice.status != Invoice.Status.PENDING:
            return Response({"error": "Cannot apply discount to a finalized invoice."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            discount = DiscountCode.objects.get(code__iexact=code_str, is_active=True)
        except DiscountCode.DoesNotExist:
            return Response({"error": "Discount code invalid."}, status=status.HTTP_404_NOT_FOUND)

        # Validate Expiry
        if discount.expiry_date and discount.expiry_date < timezone.now():
            return Response({"error": "Discount code expired."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate Fund Limit
        if discount.max_fund and discount.used_fund >= discount.max_fund:
             return Response({"error": "Discount usage limit reached."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Calculate based on original price (total + current discount) to allow code switching
            original_price = invoice.total_amount + invoice.discount_amount
            
            discount_value = (original_price * discount.percent) / 100
            if discount.max_amount_per_usage and discount_value > discount.max_amount_per_usage:
                discount_value = discount.max_amount_per_usage
            
            invoice.discount_code = discount
            invoice.discount_amount = discount_value
            # Prevent negative total
            invoice.total_amount = max(Decimal(0), original_price - discount_value)
            invoice.save()

            return Response({
                "message": "Discount applied successfully",
                "new_total": invoice.total_amount,
                "discount_amount": invoice.discount_amount,
            })

# --- MANUAL PAYMENT (New) ---

class SubmitManualPaymentView(APIView):
    """
    User submits a Reference ID for card-to-card transfer.
    
    [LOGIC UPDATE]:
    - If total_amount == 0 (100% Discount): Automatically mark PAID and fulfill immediately.
    - If total_amount > 0: Require 'reference_id' and set to WAITING_APPROVAL.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        invoice = get_object_or_404(Invoice, id=invoice_id, user=request.user)
        ref_id = request.data.get('reference_id')

        if invoice.status == Invoice.Status.PAID:
            return Response({"message": "Invoice already paid"}, status=status.HTTP_200_OK)

        # --- SCENARIO A: Free / 100% Discounted ---
        if invoice.total_amount == 0:
            with transaction.atomic():
                invoice.status = Invoice.Status.PAID
                invoice.payment_date = timezone.now()
                invoice.transaction_ref_id = ref_id if ref_id else "FREE"
                invoice.save() # [FIX] Signal handles fulfillment now
                
            return Response({"status": "paid", "message": "Order completed (Free)."})

        # --- SCENARIO B: Paid Manual Transfer ---
        if not ref_id:
            return Response({"error": "Reference ID is required for payment."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            invoice.status = Invoice.Status.WAITING_APPROVAL
            invoice.transaction_ref_id = ref_id
            invoice.save()

        return Response({"status": "submitted", "message": "Payment submitted for approval."})


# --- PAYMENT GATEWAY (Online) ---

class InitiatePaymentView(APIView):
    """
    Initiates payment via ZarinPal or fulfills free orders (100% discount).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        invoice = get_object_or_404(Invoice, id=invoice_id, user=request.user)
        
        if invoice.status == Invoice.Status.PAID:
            return Response({"message": "Invoice already paid"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Handle Free/Discounted to Zero
        if invoice.total_amount == 0:
            with transaction.atomic():
                invoice.status = Invoice.Status.PAID
                invoice.payment_date = timezone.now()
                invoice.transaction_ref_id = "FREE"
                invoice.save() # [FIX] Signal handles fulfillment now
                
            return Response({"status": "paid"}, status=status.HTTP_200_OK)

        # 2. Handle ZarinPal Gateway
        try:
            gateway = ZarinPalGateway()
            redirect_base="we dont know for now"
            authority="we dont know for now"
            is_valid, ref_id = gateway.verify_payment(authority, invoice.total_amount)

            if is_valid:
                with transaction.atomic():
                    # Update Invoice
                    invoice.status = Invoice.Status.PAID
                    invoice.transaction_ref_id = str(ref_id)
                    invoice.payment_date = timezone.now()
                    invoice.save() # [FIX] Signal handles fulfillment now
                
                return redirect(f"{redirect_base}?status=success")
            else:
                return redirect(f"{redirect_base}?status=failed&reason=verification_failed")
            
        except Exception as e:
            logger.error(f"Payment Init Failed: {e}")
            return Response({"error": "Gateway connection failed. Please try again."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

class PaymentCallbackView(APIView):
    """
    Handles the return redirect from the Bank.
    Verifies the transaction and triggers fulfillment.
    """
    permission_classes = [AllowAny] # Must be open for the bank to redirect to

    def get(self, request):
        authority = request.GET.get('Authority')
        status_param = request.GET.get('Status')
        invoice_id = request.GET.get('invoice_id')

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        
        # Safety check
        if not invoice_id:
             return redirect(f"{frontend_url}/dashboard?error=invalid_callback")

        redirect_base = f"{frontend_url}/dashboard/invoices/{invoice_id}"

        # 1. Check Bank Status (NOK means user canceled or bank failed)
        if status_param != 'OK':
            return redirect(f"{redirect_base}?status=failed&reason=canceled")

        # 2. Load Invoice
        try:
            invoice = Invoice.objects.get(id=invoice_id)
        except Invoice.DoesNotExist:
            return redirect(f"{frontend_url}/dashboard?error=invoice_not_found")

        # Idempotency check
        if invoice.status == Invoice.Status.PAID:
            return redirect(f"{redirect_base}?status=success")

        # 3. Verify with Gateway
        try:
            gateway = ZarinPalGateway()
            is_valid, ref_id = gateway.verify_payment(authority, invoice.total_amount)

            if is_valid:
                with transaction.atomic():
                    # Update Invoice
                    invoice.status = Invoice.Status.PAID
                    invoice.transaction_ref_id = str(ref_id)
                    invoice.payment_date = timezone.now()
                    invoice.save()
                    
                    # Deliver Goods (Activate Plan / Add Credits)
                    FulfillmentService.execute(invoice)
                
                return redirect(f"{redirect_base}?status=success")
            else:
                return redirect(f"{redirect_base}?status=failed&reason=verification_failed")

        except Exception as e:
            logger.error(f"Callback Verification Error: {e}")
            return redirect(f"{redirect_base}?status=failed&reason=system_error")
        
class FAQListView(generics.ListAPIView):
    """
    Public endpoint to fetch FAQs.
    """
    permission_classes = [AllowAny]
    serializer_class = FAQSerializer
    pagination_class = None
    queryset = FAQ.objects.filter(is_active=True).order_by('order')
