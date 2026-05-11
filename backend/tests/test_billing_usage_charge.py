from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from billing.models import BillingConfig, SubscriptionPlan, Transaction, UserWallet
from billing.services import process_usage_charge


class ProcessUsageChargeTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(phone_number="09120000001")
        self.wallet = self.user.wallet
        config = BillingConfig.load()
        config.tokens_per_credit = 1000
        config.daily_free_credits = Decimal("5.00")
        config.save()

    def test_free_user_partially_deducts_remaining_daily_credit(self):
        self.wallet.daily_free_used = Decimal("3.00")
        self.wallet.balance_paid = Decimal("100.00")
        self.wallet.save(update_fields=["daily_free_used", "balance_paid", "updated_at"])

        result = process_usage_charge(self.user, input_tokens=4000, output_tokens=0, run_id="run-free-partial")

        self.wallet.refresh_from_db()
        tx = Transaction.objects.get(reference_id="run-free-partial")

        self.assertTrue(result["success"])
        self.assertTrue(result["partial"])
        self.assertEqual(result["deducted"], Decimal("2.0000000000"))
        self.assertEqual(result["shortfall"], Decimal("2.0000000000"))
        self.assertEqual(self.wallet.daily_free_used, Decimal("5.0000000000"))
        self.assertEqual(self.wallet.balance_paid, Decimal("100.0000000000"))
        self.assertEqual(tx.amount, Decimal("-2.0000000000"))

    def test_active_plan_partially_deducts_plan_and_paid_balances(self):
        plan = SubscriptionPlan.objects.create(
            slug="test-plan",
            name="Test Plan",
            price=0,
            duration_days=30,
            included_credits=Decimal("0"),
        )
        self.wallet.active_plan = plan
        self.wallet.balance_plan = Decimal("1.50")
        self.wallet.balance_paid = Decimal("0.50")
        self.wallet.save(update_fields=["active_plan", "balance_plan", "balance_paid", "updated_at"])

        result = process_usage_charge(self.user, input_tokens=3000, output_tokens=0, run_id="run-plan-partial")

        self.wallet.refresh_from_db()
        tx = Transaction.objects.get(reference_id="run-plan-partial")

        self.assertTrue(result["success"])
        self.assertTrue(result["partial"])
        self.assertEqual(result["deducted"], Decimal("2.0000000000"))
        self.assertEqual(result["shortfall"], Decimal("1.0000000000"))
        self.assertEqual(self.wallet.balance_plan, Decimal("0E-10"))
        self.assertEqual(self.wallet.balance_paid, Decimal("0E-10"))
        self.assertEqual(tx.amount, Decimal("-2.0000000000"))
