import csv
from decimal import Decimal
from io import StringIO

from django.contrib import admin
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import RequestFactory
from django.test import TestCase

from billing.admin_exports import (
    export_discount_codes_csv,
    export_purchases_csv,
    export_users_csv,
)
from billing.admin import DiscountCodeAdmin, InvoiceAdmin
from billing.models import BillingProduct, DiscountCode, Invoice, SubscriptionPlan
from users.admin import CustomUserAdmin
from users.models import UserRole


def csv_rows(response):
    content = response.content.decode("utf-8-sig")
    return list(csv.DictReader(StringIO(content)))


class AdminCsvExportTests(TestCase):
    def setUp(self):
        self.role = UserRole.objects.create(slug="visitor", name="Visitor")
        self.user = get_user_model().objects.create_user(
            phone_number="09120000003",
            password="Password123!",
            full_name="Client User",
            email="client@example.com",
            national_code="1234567890",
            role=self.role,
        )
        self.plan = SubscriptionPlan.objects.create(
            slug="visitor-pro",
            name="Visitor Pro",
            price=Decimal("100000"),
            included_credits=Decimal("2500"),
        )
        self.user.wallet.active_plan = self.plan
        self.user.wallet.balance_plan = Decimal("120")
        self.user.wallet.balance_paid = Decimal("30")
        self.user.wallet.save()
        self.product = BillingProduct.objects.create(
            name="Visitor Pro Product",
            description="Plan purchase",
            price=Decimal("100000"),
            linked_plan=self.plan,
        )
        self.discount = DiscountCode.objects.create(
            code="WELCOME",
            percent=20,
            max_amount_per_usage=Decimal("25000"),
            max_fund=Decimal("1000000"),
            used_fund=Decimal("20000"),
        )
        self.invoice = Invoice.objects.create(
            user=self.user,
            status=Invoice.Status.PAID,
            subtotal_amount=Decimal("100000"),
            tax_rate=Decimal("10"),
            tax_amount=Decimal("8000"),
            total_amount=Decimal("88000"),
            content_type=ContentType.objects.get_for_model(BillingProduct),
            object_id=self.product.id,
            discount_code=self.discount,
            discount_amount=Decimal("20000"),
            transaction_ref_id="REF123",
            card_number="123456******7890",
        )
        self.admin_user = get_user_model().objects.create_superuser(
            phone_number="09120000099",
            password="Password123!",
        )
        self.factory = RequestFactory()

    def test_user_export_includes_user_wallet_and_purchase_summary(self):
        rows = csv_rows(export_users_csv(get_user_model().objects.filter(pk=self.user.pk)))

        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["phone_number"], "09120000003")
        self.assertEqual(row["full_name"], "Client User")
        self.assertEqual(row["active_plan"], "Visitor Pro")
        self.assertEqual(row["total_paid_amount"], "88000.00")
        self.assertEqual(row["total_discount_amount"], "20000.00")
        self.assertEqual(row["latest_purchase_item"], "Visitor Pro Product")
        self.assertIn("discount_code=WELCOME", row["purchase_history"])

    def test_purchase_export_includes_discount_and_payment_details(self):
        rows = csv_rows(export_purchases_csv(Invoice.objects.filter(pk=self.invoice.pk)))

        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["phone_number"], "09120000003")
        self.assertEqual(row["item_name"], "Visitor Pro Product")
        self.assertEqual(row["linked_plan"], "Visitor Pro")
        self.assertEqual(row["discount_code"], "WELCOME")
        self.assertEqual(row["discount_percent"], "20")
        self.assertEqual(row["discount_amount"], "20000.00")
        self.assertEqual(row["total_amount"], "88000.00")
        self.assertEqual(row["transaction_ref_id"], "REF123")

    def test_discount_code_export_includes_usage_and_remaining_fund(self):
        rows = csv_rows(export_discount_codes_csv(DiscountCode.objects.filter(pk=self.discount.pk)))

        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["code"], "WELCOME")
        self.assertEqual(row["percent"], "20")
        self.assertEqual(row["invoices_count"], "1")
        self.assertEqual(row["paid_invoices_count"], "1")
        self.assertEqual(row["total_discount_paid_invoices"], "20000.00")
        self.assertEqual(row["total_revenue_paid_invoices"], "88000.00")
        self.assertEqual(row["remaining_fund"], "980000.00")

    def test_admin_export_actions_include_all_rows_when_no_items_selected(self):
        other_user = get_user_model().objects.create_user(
            phone_number="09120000004",
            password="Password123!",
            full_name="Second Client",
            role=self.role,
        )
        other_discount = DiscountCode.objects.create(code="SECOND", percent=10)
        Invoice.objects.create(
            user=other_user,
            status=Invoice.Status.PENDING,
            subtotal_amount=Decimal("50000"),
            total_amount=Decimal("50000"),
            content_type=ContentType.objects.get_for_model(BillingProduct),
            object_id=self.product.id,
            discount_code=other_discount,
            discount_amount=Decimal("5000"),
        )

        user_rows = csv_rows(
            self._run_admin_action_without_selection(
                CustomUserAdmin,
                get_user_model(),
                "export_users_and_purchases",
                get_user_model().objects.none(),
            )
        )
        invoice_rows = csv_rows(
            self._run_admin_action_without_selection(
                InvoiceAdmin,
                Invoice,
                "export_purchases",
                Invoice.objects.none(),
            )
        )
        discount_rows = csv_rows(
            self._run_admin_action_without_selection(
                DiscountCodeAdmin,
                DiscountCode,
                "export_discount_codes",
                DiscountCode.objects.none(),
            )
        )

        self.assertEqual(
            {row["phone_number"] for row in user_rows},
            {"09120000003", "09120000004", "09120000099"},
        )
        self.assertEqual(len(invoice_rows), 2)
        self.assertEqual({row["code"] for row in discount_rows}, {"SECOND", "WELCOME"})

    def _run_admin_action_without_selection(self, admin_class, model, action, queryset):
        request = self.factory.post(
            "/admin/",
            {
                "action": action,
                "index": "0",
                "select_across": "0",
            },
        )
        request.user = self.admin_user
        model_admin = admin_class(model, AdminSite())
        return model_admin.response_action(request, queryset)
