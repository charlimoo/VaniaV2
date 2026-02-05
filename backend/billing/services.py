# backend/billing/services.py
import logging
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta
from django.db import transaction
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
from .utils import calculate_credit_cost 
from .models import UserWallet, Transaction, BillingConfig, BillingProduct, Invoice, SubscriptionPlan
from users.tasks import send_generic_sms 

logger = logging.getLogger(__name__)

def process_usage_charge(user, input_tokens: int, output_tokens: int, run_id: str = None) -> dict:
    """
    Deducts credits based on Plan Status.
    
    Logic:
    - IF Plan Active: Priority = Plan Balance -> Paid Balance (No Free Tier).
    - IF No Plan: Priority = Daily Free Tier ONLY (Cannot use Paid Balance).
    """
    cost = calculate_credit_cost(input_tokens, output_tokens)
    
    if cost <= 0: 
        return {
            "success": True, 
            "deducted": Decimal(0), 
            "new_daily_used": Decimal(0)
        }

    config = BillingConfig.load()
    daily_limit = config.daily_free_credits 

    with transaction.atomic():
        # Lock wallet row to prevent race conditions
        wallet, _ = UserWallet.objects.select_for_update().get_or_create(user=user)
        
        remaining_cost = cost
        
        # Check Plan Status
        is_plan_active = (
            wallet.active_plan is not None and 
            wallet.plan_expires_at is not None and 
            wallet.plan_expires_at > timezone.now()
        )

        if is_plan_active:
            # --- SCENARIO A: SUBSCRIBER ---
            # 1. Use Plan Balance
            if remaining_cost > 0 and wallet.balance_plan > 0:
                deduct = min(wallet.balance_plan, remaining_cost)
                wallet.balance_plan -= deduct
                remaining_cost -= deduct
            
            # 2. Use Paid Balance (Overage)
            if remaining_cost > 0 and wallet.balance_paid > 0:
                deduct = min(wallet.balance_paid, remaining_cost)
                wallet.balance_paid -= deduct
                remaining_cost -= deduct
                
        else:
            # --- SCENARIO B: FREE USER ---
            # 1. Use Daily Free Tier ONLY
            free_available = max(Decimal(0), daily_limit - wallet.daily_free_used)
            if free_available > 0:
                deduct = min(free_available, remaining_cost)
                wallet.daily_free_used += deduct
                remaining_cost -= deduct
            
            # Note: Paid balance is intentionally ignored here per requirements.
            
        # Check Shortfall
        if remaining_cost > 0:
            msg = "Insufficient credits."
            if not is_plan_active and wallet.balance_paid > 0:
                msg = "Active plan required to use top-up balance."
                
            return {
                "success": False, 
                "message": msg, 
                "shortfall": remaining_cost
            }
            
        wallet.save()
        
        # Log Transaction
        Transaction.objects.create(
            wallet=wallet,
            amount=-cost,
            transaction_type=Transaction.TransactionType.SPEND,
            description=f"Run {run_id or 'N/A'}",
            reference_id=run_id
        )
        
        return {
            "success": True, 
            "deducted": cost,
            "wallet_id": wallet.id,
            "new_daily_used": wallet.daily_free_used
        }

def process_service_charge(user, amount: Decimal, description: str) -> dict:
    """
    Deducts credits for services (Transcription).
    Follows same strict Plan vs Free logic.
    """
    if amount <= 0:
        return {"success": True}

    daily_limit = BillingConfig.load().daily_free_credits

    with transaction.atomic():
        wallet, _ = UserWallet.objects.select_for_update().get_or_create(user=user)
        
        is_plan_active = (
            wallet.active_plan is not None and 
            wallet.plan_expires_at is not None and 
            wallet.plan_expires_at > timezone.now()
        )
        
        # Calculate Total Available based on status
        if is_plan_active:
            total_available = wallet.balance_plan + wallet.balance_paid
        else:
            total_available = max(Decimal(0), daily_limit - wallet.daily_free_used)
        
        if total_available < amount:
            msg = "اعتبار کافی نیست."
            if not is_plan_active and (wallet.balance_plan + wallet.balance_paid) >= amount:
                msg = "برای استفاده از اعتبار ذخیره شده، نیاز به طرح فعال دارید."
            return {
                "success": False, 
                "message": msg, 
                "shortfall": amount - total_available
            }

        remaining_cost = amount

        if is_plan_active:
            # 1. Plan
            if remaining_cost > 0 and wallet.balance_plan > 0:
                deduct = min(wallet.balance_plan, remaining_cost)
                wallet.balance_plan -= deduct
                remaining_cost -= deduct

            # 2. Paid
            if remaining_cost > 0 and wallet.balance_paid > 0:
                deduct = min(wallet.balance_paid, remaining_cost)
                wallet.balance_paid -= deduct
                remaining_cost -= deduct
        else:
            # 1. Free
            if remaining_cost > 0:
                # We already checked availability above
                wallet.daily_free_used += remaining_cost
                remaining_cost = 0

        wallet.save()

        Transaction.objects.create(
            wallet=wallet,
            amount=-amount,
            transaction_type=Transaction.TransactionType.SERVICE_CHARGE,
            description=description
        )

        return {"success": True}

class FulfillmentService:
    """
    Handles the delivery of purchased items (Plans or Credits) 
    once an Invoice status becomes PAID.
    """
    @classmethod
    @transaction.atomic
    def execute(cls, invoice: Invoice):
        if invoice.status != Invoice.Status.PAID: 
            logger.warning(f"Attempted fulfillment on unpaid invoice {invoice.id}")
            return
        
        # [FIX] IDEMPOTENCY CHECK
        # Check if a transaction for this invoice already exists to prevent double-dipping
        if Transaction.objects.filter(reference_id=str(invoice.id)).exists():
            logger.info(f"⚠️ Invoice {invoice.id} already fulfilled. Skipping.")
            return

        # The content_object is always a BillingProduct in this new architecture
        product = invoice.content_object
        user = invoice.user
        
        logger.info(f"🚀 Fulfilling Invoice {invoice.id} for User {user.id}")

        if isinstance(product, BillingProduct):
            cls._fulfill_product(user, product, invoice)
        else:
            logger.error(f"Unknown content object in invoice {invoice.id}: {type(product)}")

    @staticmethod
    def _fulfill_product(user, product: BillingProduct, invoice: Invoice):
        wallet, _ = UserWallet.objects.select_for_update().get_or_create(user=user)
        now = timezone.now()
        
        # 1. Handle Plan Activation
        if product.linked_plan:
            new_plan = product.linked_plan
            
            # CHECK: Is this a Renewal? (Same Plan + Not Expired)
            is_renewal = (
                wallet.active_plan and 
                wallet.active_plan.id == new_plan.id and
                wallet.plan_expires_at and 
                wallet.plan_expires_at > now
            )

            if is_renewal:
                # --- RENEWAL LOGIC ---
                # 1. Extend Time: Add duration to the EXISTING expiry date
                wallet.plan_expires_at = wallet.plan_expires_at + timedelta(days=new_plan.duration_days)
                
                # 2. Refill Credits: 
                # Choice A (Aggressive): wallet.balance_plan = new_plan.included_credits (Reset)
                # Choice B (Friendly): wallet.balance_plan += new_plan.included_credits (Stack)
                
                # We use Choice A (Reset) because it's a subscription quota. 
                # However, to avoid user anger if they renew early, we take the max
                # of (current + new) vs (new). Actually, simplest is just Reset for subscriptions.
                # But for a token economy, Stacking is often expected if they pay early.
                
                # Let's go with Stacking for Renewal to be safe:
                wallet.balance_plan += new_plan.included_credits
                
                desc = f"Renewed Plan: {new_plan.name} (Extended)"
            else:
                # --- NEW / UPGRADE / EXPIRED LOGIC ---
                # Hard Reset (Start Fresh)
                wallet.active_plan = new_plan
                wallet.plan_expires_at = now + timedelta(days=new_plan.duration_days)
                wallet.balance_plan = new_plan.included_credits
                desc = f"Activated Plan: {new_plan.name}"

            Transaction.objects.create(
                wallet=wallet,
                amount=new_plan.included_credits,
                transaction_type=Transaction.TransactionType.PLAN_ACTIVATION,
                description=desc,
                reference_id=str(invoice.id)
            )
            
            # Async Notification
            try:
                send_generic_sms.delay(user.phone_number, f"اشتراک جدید برای شما فعال شد.")
            except Exception as e:
                logger.error(f"SMS Error: {e}")

        # 2. Handle Credit Top-Up (if product has credit amount)
        if product.credit_amount > 0:
            wallet.balance_paid += product.credit_amount
            
            Transaction.objects.create(
                wallet=wallet,
                amount=product.credit_amount,
                transaction_type=Transaction.TransactionType.DEPOSIT,
                description=f"Top-up: {product.name}",
                reference_id=str(invoice.id)
            )
            
            # Async Notification
            try:
                send_generic_sms.delay(user.phone_number, f"مبلغ {int(product.credit_amount)} سرمایه گفت‌وگو به حساب شما اضافه شد.")
            except Exception as e:
                logger.error(f"SMS Error: {e}")
            
        wallet.save()