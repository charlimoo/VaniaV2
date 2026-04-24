from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase
from django.utils import timezone

from billing.models import BillingProduct, Invoice, SubscriptionPlan, Transaction
from billing.services import FulfillmentService
from users.models import UserRole


class FulfillmentServicePlanCreditTests(TestCase):
    def setUp(self):
        visitor_role = UserRole.objects.create(slug="visitor", name="مراجعه‌کننده")
        self.user = get_user_model().objects.create_user(
            phone_number="09120000002",
            password="Password123!",
            role=visitor_role,
        )
        self.wallet = self.user.wallet

    def _create_plan_product(self, *, slug: str, name: str, included_credits: str, duration_days: int = 30):
        plan = SubscriptionPlan.objects.create(
            slug=slug,
            name=name,
            price=Decimal("1000"),
            duration_days=duration_days,
            included_credits=Decimal(included_credits),
        )
        product = BillingProduct.objects.create(
            name=f"{name} Product",
            price=Decimal("1000"),
            linked_plan=plan,
        )
        return plan, product

    def _create_paid_invoice(self, product: BillingProduct):
        return Invoice.objects.create(
            user=self.user,
            status=Invoice.Status.PAID,
            total_amount=product.price,
            content_type=ContentType.objects.get_for_model(BillingProduct),
            object_id=product.id,
        )

    @patch("billing.services.send_generic_sms.delay")
    def test_same_plan_renewal_stacks_credits_and_extends_expiry(self, _mock_sms):
        plan, product = self._create_plan_product(
            slug="visitor-30d",
            name="Visitor 30D",
            included_credits="100",
            duration_days=30,
        )
        self.wallet.active_plan = plan
        self.wallet.plan_expires_at = timezone.now() + timezone.timedelta(days=12)
        original_expiry = self.wallet.plan_expires_at
        self.wallet.balance_plan = Decimal("35")
        self.wallet.save(update_fields=["active_plan", "plan_expires_at", "balance_plan", "updated_at"])

        FulfillmentService.execute(self._create_paid_invoice(product))

        self.wallet.refresh_from_db()
        tx = Transaction.objects.get(
            wallet=self.wallet,
            transaction_type=Transaction.TransactionType.PLAN_ACTIVATION,
        )

        self.assertEqual(self.wallet.active_plan_id, plan.id)
        self.assertEqual(self.wallet.balance_plan, Decimal("135.0000000000"))
        self.assertEqual(
            self.wallet.plan_expires_at,
            original_expiry + timezone.timedelta(days=30),
        )
        self.assertEqual(tx.amount, Decimal("100.0000000000"))
        self.assertIn("Renewed Plan", tx.description)

    @patch("billing.services.send_generic_sms.delay")
    def test_active_plan_upgrade_keeps_remaining_credits_and_adds_new_plan_credits(self, _mock_sms):
        current_plan, _current_product = self._create_plan_product(
            slug="visitor-basic-30d",
            name="Visitor Basic",
            included_credits="100",
            duration_days=30,
        )
        upgraded_plan, upgraded_product = self._create_plan_product(
            slug="expert-30d",
            name="Expert 30D",
            included_credits="250",
            duration_days=30,
        )

        self.wallet.active_plan = current_plan
        self.wallet.plan_expires_at = timezone.now() + timezone.timedelta(days=8)
        self.wallet.balance_plan = Decimal("40")
        self.wallet.save(update_fields=["active_plan", "plan_expires_at", "balance_plan", "updated_at"])

        FulfillmentService.execute(self._create_paid_invoice(upgraded_product))

        self.wallet.refresh_from_db()
        tx = Transaction.objects.get(
            wallet=self.wallet,
            transaction_type=Transaction.TransactionType.PLAN_ACTIVATION,
        )

        self.assertEqual(self.wallet.active_plan_id, upgraded_plan.id)
        self.assertEqual(self.wallet.balance_plan, Decimal("290.0000000000"))
        self.assertGreater(self.wallet.plan_expires_at, timezone.now())
        self.assertEqual(tx.amount, Decimal("250.0000000000"))
        self.assertIn("Upgraded Plan", tx.description)

    @patch("billing.services.send_generic_sms.delay")
    def test_expired_plan_does_not_carry_old_subscription_balance(self, _mock_sms):
        expired_plan, _expired_product = self._create_plan_product(
            slug="expired-30d",
            name="Expired 30D",
            included_credits="100",
            duration_days=30,
        )
        new_plan, new_product = self._create_plan_product(
            slug="visitor-pro-30d",
            name="Visitor Pro",
            included_credits="200",
            duration_days=30,
        )

        self.wallet.active_plan = expired_plan
        self.wallet.plan_expires_at = timezone.now() - timezone.timedelta(days=1)
        self.wallet.balance_plan = Decimal("55")
        self.wallet.save(update_fields=["active_plan", "plan_expires_at", "balance_plan", "updated_at"])

        FulfillmentService.execute(self._create_paid_invoice(new_product))

        self.wallet.refresh_from_db()

        self.assertEqual(self.wallet.active_plan_id, new_plan.id)
        self.assertEqual(self.wallet.balance_plan, Decimal("200.0000000000"))
