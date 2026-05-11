from decimal import Decimal
from unittest.mock import patch

from django.contrib.contenttypes.models import ContentType
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from billing.models import BillingProduct, DiscountCode, Invoice
from users.models import CustomUser, UserRole


@override_settings(APP_URL="http://localhost:3000")
class PaymentCallbackSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.role, _ = UserRole.objects.get_or_create(name="مراجعه‌کننده", slug="visitor")
        self.user = CustomUser.objects.create_user(
            phone_number="09120000031",
            password="StrongPass123!",
            role=self.role,
        )
        self.product = BillingProduct.objects.create(
            name="Credit Pack",
            description="Test pack",
            price="100000",
            credit_amount="10",
            is_active=True,
        )
        self.invoice = Invoice.objects.create(
            user=self.user,
            total_amount="100000",
            status=Invoice.Status.PENDING,
            content_type=ContentType.objects.get_for_model(BillingProduct),
            object_id=self.product.id,
        )

    @patch("billing.views.ZibalGateway.request_payment")
    def test_payment_initiation_persists_authority(self, mock_request_payment):
        mock_request_payment.return_value = {"url": "https://gateway.example/pay", "authority": "track-123"}
        self.client.force_authenticate(self.user)

        response = self.client.post(f"/api/billing/pay/{self.invoice.id}/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.authority, "track-123")

    @patch("billing.views.ZibalGateway.verify_payment")
    def test_callback_rejects_authority_mismatch(self, mock_verify_payment):
        self.invoice.authority = "track-expected"
        self.invoice.save(update_fields=["authority"])

        response = self.client.get(
            "/api/billing/zibal/callback/",
            {"orderId": str(self.invoice.id), "trackId": "track-other", "success": "1"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertIn("authority_mismatch", response.url)
        mock_verify_payment.assert_not_called()

    def test_purchase_adds_ten_percent_vat_to_invoice_total(self):
        self.client.force_authenticate(self.user)

        response = self.client.post("/api/billing/purchase/", {"id": self.product.id}, format="json")

        self.assertEqual(response.status_code, 201)
        invoice = Invoice.objects.get(id=response.data["invoice_id"])
        self.assertEqual(invoice.subtotal_amount, Decimal("100000.00"))
        self.assertEqual(invoice.tax_rate, Decimal("10.00"))
        self.assertEqual(invoice.tax_amount, Decimal("10000.00"))
        self.assertEqual(invoice.total_amount, Decimal("110000.00"))

    def test_discount_applies_before_vat(self):
        self.client.force_authenticate(self.user)
        purchase_response = self.client.post("/api/billing/purchase/", {"id": self.product.id}, format="json")
        invoice_id = purchase_response.data["invoice_id"]
        DiscountCode.objects.create(code="VAT20", percent=20, is_active=True)

        response = self.client.post(
            f"/api/billing/invoices/{invoice_id}/apply_discount/",
            {"code": "VAT20"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        invoice = Invoice.objects.get(id=invoice_id)
        self.assertEqual(invoice.discount_amount, Decimal("20000.00"))
        self.assertEqual(invoice.tax_amount, Decimal("8000.00"))
        self.assertEqual(invoice.total_amount, Decimal("88000.00"))
