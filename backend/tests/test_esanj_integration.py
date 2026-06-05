import json
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from asgiref.sync import async_to_sync
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from agno.run import RunContext

from agents.context import resource_context, selected_case_context
from capabilities.vania_expert.tools import get_test_result_details, manage_clinical_tests
from capabilities.vania_visitor.tools import get_my_test_result_details, update_my_test_result
from billing.models import BillingConfig, Invoice
from users.models import CustomUser, ExpertProfession, UserRole
from vania_core.esanj_client import EsanjConfigurationError
from vania_core.esanj_views import sync_esanj_test_bank
from vania_core.case_service import CaseService
from vania_core.models import EsanjTestAccessRule, EsanjTestAttempt, TreatmentConnection
from vania_core.tests_service import ClinicalTestsService


class EsanjIntegrationTests(TestCase):
    def setUp(self):
        cache.delete("billing_config")
        self.client = APIClient()
        self.visitor_role, _ = UserRole.objects.get_or_create(name="مراجعه‌کننده", slug="visitor")
        self.expert_role, _ = UserRole.objects.get_or_create(name="متخصص", slug="expert")
        self.psychologist = ExpertProfession.objects.create(slug="psychologist", name="روانشناس")
        self.lawyer = ExpertProfession.objects.create(slug="lawyer", name="وکیل")
        self.visitor = CustomUser.objects.create_user(phone_number="09120001001", role=self.visitor_role)
        self.other_visitor = CustomUser.objects.create_user(phone_number="09120001002", role=self.visitor_role)
        self.expert = CustomUser.objects.create_user(
            phone_number="09120001003",
            role=self.expert_role,
            expert_profession=self.psychologist,
            is_expert_verified=True,
        )

    def _rule(self, test_id: int, title: str, **kwargs):
        defaults = {
            "is_active": True,
            "allow_visitors": True,
            "allow_experts": False,
        }
        defaults.update(kwargs)
        return EsanjTestAccessRule.objects.create(esanj_test_id=test_id, title=title, **defaults)

    def _questionnaire(self):
        return {
            "test": {"id": 11, "title": "تست نمونه"},
            "questions": [
                {
                    "row": 1,
                    "title": "سوال اول",
                    "answers": [{"row": 1, "title": "کم", "value": "0"}, {"row": 2, "title": "زیاد", "value": "1"}],
                },
                {
                    "row": 2,
                    "title": "سوال دوم",
                    "answers": [{"row": 1, "title": "خیر", "value": "0"}, {"row": 2, "title": "بله", "value": "1"}],
                },
            ],
        }

    def _alternate_questionnaire(self):
        return {
            "test": {"id": 42, "title": "تست متفاوت"},
            "questions": [
                {
                    "row": 10,
                    "title": "سوال متفاوت اول",
                    "answers": [{"row": 1, "title": "الف", "value": "3"}, {"row": 2, "title": "ب", "value": "4"}],
                },
                {
                    "row": 20,
                    "title": "سوال متفاوت دوم",
                    "answers": [{"row": 1, "title": "ج", "value": "7"}, {"row": 2, "title": "د", "value": "8"}],
                },
                {
                    "row": 30,
                    "title": "سوال متفاوت سوم",
                    "answers": [{"row": 1, "title": "ه", "value": "11"}, {"row": 2, "title": "و", "value": "12"}],
                },
            ],
        }

    def test_catalog_applies_role_and_profession_access(self):
        visitor_rule = self._rule(11, "آزمون عمومی", allow_visitors=True, allow_experts=False)
        expert_rule = self._rule(12, "آزمون متخصصان", allow_visitors=False, allow_experts=True)
        restricted_rule = self._rule(13, "آزمون روانشناسان", allow_visitors=False, allow_experts=True)
        restricted_rule.eligible_expert_professions.add(self.psychologist)
        hidden_rule = self._rule(14, "آزمون غیرفعال", is_active=False)

        self.client.force_authenticate(self.visitor)
        response = self.client.get("/api/vania/esanj/tests/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["esanj_test_id"] for item in response.data["tests"]], [visitor_rule.esanj_test_id])

        self.client.force_authenticate(self.expert)
        response = self.client.get("/api/vania/esanj/tests/")
        self.assertEqual(response.status_code, 200)
        returned_ids = {item["esanj_test_id"] for item in response.data["tests"]}
        self.assertIn(expert_rule.esanj_test_id, returned_ids)
        self.assertIn(restricted_rule.esanj_test_id, returned_ids)
        self.assertNotIn(hidden_rule.esanj_test_id, returned_ids)

    def test_sync_defaults_new_tests_to_all_users(self):
        client = SimpleNamespace(test_bank=lambda: [
            {"test_id": 101, "test": {"id": 101, "title": "تست عمومی اول"}},
            {"test_id": 102, "test": {"id": 102, "title": "تست عمومی دوم"}},
        ])

        created, updated = sync_esanj_test_bank(client=client)

        self.assertEqual((created, updated), (2, 0))
        rules = list(EsanjTestAccessRule.objects.order_by("esanj_test_id"))
        self.assertEqual([rule.esanj_test_id for rule in rules], [101, 102])
        self.assertTrue(all(rule.is_active for rule in rules))
        self.assertTrue(all(rule.allow_visitors for rule in rules))
        self.assertTrue(all(rule.allow_experts for rule in rules))

        self.client.force_authenticate(self.visitor)
        visitor_catalog = self.client.get("/api/vania/esanj/tests/")
        self.assertEqual({item["esanj_test_id"] for item in visitor_catalog.data["tests"]}, {101, 102})

        self.client.force_authenticate(self.expert)
        expert_catalog = self.client.get("/api/vania/esanj/tests/")
        self.assertEqual({item["esanj_test_id"] for item in expert_catalog.data["tests"]}, {101, 102})

    def test_sync_preserves_existing_access_when_any_rule_is_enabled(self):
        self._rule(201, "تنظیم‌شده", is_active=True, allow_visitors=False, allow_experts=True)
        disabled = self._rule(202, "غیرفعال", is_active=False, allow_visitors=False, allow_experts=False)
        client = SimpleNamespace(test_bank=lambda: [
            {"test_id": 201, "test": {"id": 201, "title": "عنوان تازه"}},
            {"test_id": 202, "test": {"id": 202, "title": "غیرفعال تازه"}},
        ])

        created, updated = sync_esanj_test_bank(client=client)

        self.assertEqual((created, updated), (0, 2))
        disabled.refresh_from_db()
        self.assertFalse(disabled.is_active)
        self.assertFalse(disabled.allow_visitors)
        self.assertFalse(disabled.allow_experts)
        self.assertEqual(EsanjTestAccessRule.objects.get(esanj_test_id=201).title, "عنوان تازه")

    def test_sync_opens_full_bank_when_no_rule_is_enabled(self):
        self._rule(301, "هیچ‌کس", is_active=False, allow_visitors=False, allow_experts=False)
        client = SimpleNamespace(test_bank=lambda: [
            {"test_id": 301, "test": {"id": 301, "title": "همه فعال اول"}},
            {"test_id": 302, "test": {"id": 302, "title": "همه فعال دوم"}},
        ])

        created, updated = sync_esanj_test_bank(client=client)

        self.assertEqual((created, updated), (1, 1))
        rules = list(EsanjTestAccessRule.objects.order_by("esanj_test_id"))
        self.assertEqual([rule.esanj_test_id for rule in rules], [301, 302])
        self.assertTrue(all(rule.is_active for rule in rules))
        self.assertTrue(all(rule.allow_visitors for rule in rules))
        self.assertTrue(all(rule.allow_experts for rule in rules))

    def test_start_save_and_submit_attempt(self):
        self._rule(11, "تست نمونه")
        self.client.force_authenticate(self.visitor)

        with (
            patch("vania_core.esanj_views.EsanjClient") as client_class,
            patch("vania_core.esanj_views.ensure_esanj_employee", return_value=SimpleNamespace(employee_id=7001)),
        ):
            esanj = client_class.return_value
            esanj.questionnaire.return_value = self._questionnaire()
            esanj.submit_interpretation.return_value = {"summary": "نتیجه آماده است"}
            esanj.get_grading.return_value = {"score": 2}

            start = self.client.post(
                "/api/vania/esanj/attempts/",
                {"test_id": 11, "age": 31, "sex": "female"},
                format="json",
            )
            self.assertEqual(start.status_code, 201)
            attempt_id = start.data["id"]

            save = self.client.patch(
                f"/api/vania/esanj/attempts/{attempt_id}/",
                {"answers": {"1": "1"}},
                format="json",
            )
            self.assertEqual(save.status_code, 200)
            self.assertEqual(save.data["progress"], {"answered": 1, "total": 2})

            submit = self.client.post(
                f"/api/vania/esanj/attempts/{attempt_id}/submit/",
                {"answers": {"2": "1"}},
                format="json",
            )
            self.assertEqual(submit.status_code, 200)
            self.assertEqual(submit.data["status"], EsanjTestAttempt.Status.COMPLETED)
            self.assertEqual(submit.data["result"]["json"]["summary"], "نتیجه آماده است")
            esanj.submit_interpretation.assert_called_once()

    def test_starting_paid_interactive_test_creates_invoice_before_attempt(self):
        rule = self._rule(81, "تست پولی", base_price=1000)
        self.client.force_authenticate(self.visitor)

        with patch("vania_core.esanj_views.EsanjClient") as client_class:
            response = self.client.post(
                "/api/vania/esanj/attempts/",
                {"test_id": rule.esanj_test_id, "age": 31, "sex": "female"},
                format="json",
            )

        self.assertEqual(response.status_code, 402)
        self.assertTrue(response.data["payment_required"])
        self.assertEqual(response.data["pricing"]["markup_percent"], "10.00")
        self.assertEqual(response.data["pricing"]["subtotal_amount"], "1100.00")
        self.assertEqual(response.data["pricing"]["tax_amount"], "110.00")
        self.assertEqual(response.data["pricing"]["total_amount"], "1210.00")
        self.assertIn("/dashboard/invoices/", response.data["redirect_url"])
        client_class.assert_not_called()
        self.assertEqual(EsanjTestAttempt.objects.count(), 0)

        invoice = Invoice.objects.get(id=response.data["invoice_id"])
        self.assertEqual(invoice.user, self.visitor)
        self.assertEqual(invoice.status, Invoice.Status.PENDING)
        self.assertEqual(invoice.content_object, rule)
        self.assertEqual(invoice.subtotal_amount, Decimal("1100.00"))
        self.assertEqual(invoice.tax_amount, Decimal("110.00"))
        self.assertEqual(invoice.total_amount, Decimal("1210.00"))

    def test_catalog_marks_paid_interactive_tests_as_purchased(self):
        paid_rule = self._rule(84, "تست خریداری شده", base_price=1000)
        unpaid_rule = self._rule(85, "تست خریداری نشده", base_price=1000)
        Invoice.objects.create(
            user=self.visitor,
            status=Invoice.Status.PAID,
            subtotal_amount=Decimal("1100.00"),
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("110.00"),
            total_amount=Decimal("1210.00"),
            content_object=paid_rule,
        )
        self.client.force_authenticate(self.visitor)

        response = self.client.get("/api/vania/esanj/tests/")

        self.assertEqual(response.status_code, 200)
        by_test_id = {item["esanj_test_id"]: item for item in response.data["tests"]}
        self.assertTrue(by_test_id[paid_rule.esanj_test_id]["is_purchased"])
        self.assertFalse(by_test_id[unpaid_rule.esanj_test_id]["is_purchased"])

    def test_interactive_test_markup_uses_billing_config(self):
        config = BillingConfig.load()
        config.esanj_test_markup_percent = Decimal("25.00")
        config.save()
        rule = self._rule(82, "تست با سود متغیر", base_price=2000)
        self.client.force_authenticate(self.visitor)

        response = self.client.post(
            "/api/vania/esanj/attempts/",
            {"test_id": rule.esanj_test_id, "age": 31, "sex": "female"},
            format="json",
        )

        self.assertEqual(response.status_code, 402)
        self.assertEqual(response.data["pricing"]["markup_percent"], "25.00")
        self.assertEqual(response.data["pricing"]["subtotal_amount"], "2500.00")
        self.assertEqual(response.data["pricing"]["tax_amount"], "250.00")
        self.assertEqual(response.data["pricing"]["total_amount"], "2750.00")

    def test_paid_interactive_test_invoice_unlocks_attempt_start(self):
        rule = self._rule(83, "تست پرداخت شده", base_price=1000)
        self.client.force_authenticate(self.visitor)

        payment = self.client.post(
            "/api/vania/esanj/attempts/",
            {"test_id": rule.esanj_test_id, "age": 31, "sex": "female"},
            format="json",
        )
        self.assertEqual(payment.status_code, 402)
        invoice = Invoice.objects.get(id=payment.data["invoice_id"])
        invoice.status = Invoice.Status.PAID
        invoice.save(update_fields=["status"])

        with (
            patch("vania_core.esanj_views.EsanjClient") as client_class,
            patch("vania_core.esanj_views.ensure_esanj_employee", return_value=SimpleNamespace(employee_id=7001)),
        ):
            esanj = client_class.return_value
            esanj.questionnaire.return_value = self._questionnaire()
            response = self.client.post(
                "/api/vania/esanj/attempts/",
                {"test_id": rule.esanj_test_id, "age": 31, "sex": "female"},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["esanj_test_id"], rule.esanj_test_id)
        esanj.questionnaire.assert_called_once_with(rule.esanj_test_id)

    def test_attempts_are_private_to_the_owner(self):
        rule = self._rule(11, "تست نمونه")
        attempt = EsanjTestAttempt.objects.create(
            user=self.other_visitor,
            access_rule=rule,
            esanj_test_id=rule.esanj_test_id,
            test_title=rule.title,
            age=24,
            sex=EsanjTestAttempt.Sex.MALE,
            questionnaire=self._questionnaire(),
        )

        self.client.force_authenticate(self.visitor)
        response = self.client.get(f"/api/vania/esanj/attempts/{attempt.id}/")

        self.assertEqual(response.status_code, 404)

    def test_missing_esanj_config_does_not_fail_attempt(self):
        rule = self._rule(11, "تست نمونه")
        attempt = EsanjTestAttempt.objects.create(
            user=self.visitor,
            access_rule=rule,
            esanj_test_id=rule.esanj_test_id,
            test_title=rule.title,
            age=24,
            sex=EsanjTestAttempt.Sex.FEMALE,
            questionnaire=self._questionnaire(),
            answers={"1": "1", "2": "0"},
        )

        self.client.force_authenticate(self.visitor)
        with patch("vania_core.esanj_views.EsanjClient") as client_class:
            client_class.return_value.submit_interpretation.side_effect = EsanjConfigurationError("missing")
            response = self.client.post(f"/api/vania/esanj/attempts/{attempt.id}/submit/", {}, format="json")

        self.assertEqual(response.status_code, 503)
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, EsanjTestAttempt.Status.IN_PROGRESS)
        self.assertEqual(attempt.error_message, "")

    def test_submit_rejects_answer_values_outside_questionnaire_options(self):
        rule = self._rule(11, "تست نمونه")
        attempt = EsanjTestAttempt.objects.create(
            user=self.visitor,
            access_rule=rule,
            esanj_test_id=rule.esanj_test_id,
            test_title=rule.title,
            age=24,
            sex=EsanjTestAttempt.Sex.FEMALE,
            questionnaire=self._questionnaire(),
            answers={"1": "99", "2": "0"},
        )

        self.client.force_authenticate(self.visitor)
        response = self.client.post(f"/api/vania/esanj/attempts/{attempt.id}/submit/", {}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("سازگار نیست", response.data["error"])

    def test_expert_assigned_interactive_test_syncs_result_to_clinical_history(self):
        self._rule(11, "تست تعاملی نمونه", allow_visitors=False, allow_experts=True)
        TreatmentConnection.objects.create(
            doctor=self.expert,
            patient=self.visitor,
            status=TreatmentConnection.Status.ACTIVE,
        )
        case = CaseService.create_case(self.visitor, self.expert, title="پرونده تست")

        self.client.force_authenticate(self.expert)
        assigned = self.client.post(
            "/api/vania/tests/",
            {
                "patient_id": self.visitor.id,
                "case_id": case["id"],
                "source": "interactive",
                "interactive_test_id": 11,
            },
            format="json",
        )
        self.assertEqual(assigned.status_code, 201)
        self.assertEqual(assigned.data["source"], "interactive")
        self.assertEqual(assigned.data["interactive_status"], "ASSIGNED")

        self.client.force_authenticate(self.visitor)
        with (
            patch("vania_core.esanj_views.EsanjClient") as client_class,
            patch("vania_core.esanj_views.ensure_esanj_employee", return_value=SimpleNamespace(employee_id=7001)),
        ):
            esanj = client_class.return_value
            esanj.questionnaire.return_value = self._questionnaire()
            esanj.submit_interpretation.return_value = {"summary": "نتیجه ارجاع آماده است"}
            esanj.get_grading.return_value = {"score": 2}

            start = self.client.post(
                "/api/vania/esanj/attempts/",
                {
                    "clinical_test_id": assigned.data["id"],
                    "doctor_id": self.expert.id,
                    "case_id": case["id"],
                    "age": 31,
                    "sex": "female",
                },
                format="json",
            )
            self.assertEqual(start.status_code, 201)
            self.assertEqual(start.data["clinical_test_id"], assigned.data["id"])

            submit = self.client.post(
                f"/api/vania/esanj/attempts/{start.data['id']}/submit/",
                {"answers": {"1": "1", "2": "1"}},
                format="json",
            )

        self.assertEqual(submit.status_code, 200)
        self.assertEqual(submit.data["status"], EsanjTestAttempt.Status.COMPLETED)

        saved_test = ClinicalTestsService.get_test(
            self.visitor,
            assigned.data["id"],
            doctor_id=self.expert.id,
            case_id=case["id"],
        )
        self.assertEqual(saved_test["interactive_status"], EsanjTestAttempt.Status.COMPLETED)
        self.assertIn("نتیجه ارجاع آماده است", saved_test["result_text"])

        result_bundle = ClinicalTestsService.read_test_result_bundle(
            self.visitor,
            assigned.data["id"],
            doctor_id=self.expert.id,
            case_id=case["id"],
        )
        self.assertEqual(result_bundle["interactive_result"]["json"]["summary"], "نتیجه ارجاع آماده است")

    def test_agent_test_tool_schema_allows_primitive_assignment_data(self):
        data_schema = manage_clinical_tests.parameters["properties"]["data"]
        self.assertEqual(data_schema["type"], "object")
        self.assertIn("anyOf", data_schema["additionalProperties"])
        allowed_types = {item["type"] for item in data_schema["additionalProperties"]["anyOf"]}
        self.assertIn("number", allowed_types)
        self.assertIn("string", allowed_types)

    def test_agent_can_list_and_assign_interactive_tests(self):
        self._rule(21, "تست تعاملی برای ابزار", allow_visitors=False, allow_experts=True)
        TreatmentConnection.objects.create(
            doctor=self.expert,
            patient=self.visitor,
            status=TreatmentConnection.Status.ACTIVE,
        )
        case = CaseService.create_case(self.visitor, self.expert, title="پرونده ابزار")
        run_context = RunContext(run_id="agent-test-run", session_id="agent-test-session", user_id=str(self.expert.id))

        async def fake_refresh(*args, **kwargs):
            return "canvas refreshed"

        async def collect(action, data=None):
            generator = await manage_clinical_tests.entrypoint(run_context, action=action, data=data)
            return [
                item
                async for item in generator
            ]

        resource_token = resource_context.set(str(self.visitor.id))
        case_token = selected_case_context.set(case["id"])
        try:
            with patch("capabilities.vania_expert.tools._emit_canvas_refresh", new=fake_refresh):
                listed = async_to_sync(collect)("LIST")
                payload = json.loads(listed[0])
                self.assertEqual(payload["available_interactive_tests"][0]["interactive_test_id"], 21)

                assigned_output = async_to_sync(collect)("ADD_TEST", {"source": "interactive", "interactive_test_id": 21})
                self.assertIn("Clinical tests updated", assigned_output[-1])
        finally:
            resource_context.reset(resource_token)
            selected_case_context.reset(case_token)

        tests = ClinicalTestsService.get_tests(self.visitor, doctor_id=self.expert.id, case_id=case["id"])
        self.assertEqual(len(tests), 1)
        self.assertEqual(tests[0]["source"], "interactive")
        self.assertEqual(tests[0]["interactive_test_id"], 21)

    def test_agent_reads_interactive_test_result_details(self):
        rule = self._rule(31, "تست نتیجه ابزار", allow_visitors=False, allow_experts=True)
        TreatmentConnection.objects.create(
            doctor=self.expert,
            patient=self.visitor,
            status=TreatmentConnection.Status.ACTIVE,
        )
        case = CaseService.create_case(self.visitor, self.expert, title="پرونده نتیجه")
        assigned = ClinicalTestsService.add_test(
            patient=self.visitor,
            created_by=self.expert,
            title=rule.title,
            doctor_id=self.expert.id,
            case_id=case["id"],
            source="interactive",
            interactive_test_id=rule.esanj_test_id,
        )
        attempt = EsanjTestAttempt.objects.create(
            user=self.visitor,
            access_rule=rule,
            clinical_test_id=assigned["id"],
            assigned_by=self.expert,
            doctor_id=self.expert.id,
            case_id=case["id"],
            esanj_test_id=rule.esanj_test_id,
            test_title=rule.title,
            status=EsanjTestAttempt.Status.COMPLETED,
            age=30,
            sex=EsanjTestAttempt.Sex.FEMALE,
            questionnaire=self._questionnaire(),
            answers={"1": "1", "2": "0"},
            result_json={"summary": "نتیجه قابل خواندن توسط ابزار"},
            grading_json={"score": 1},
        )
        ClinicalTestsService.update_interactive_assignment_from_attempt(self.visitor, attempt, creator=self.visitor)
        run_context = RunContext(run_id="agent-test-run", session_id="agent-test-session", user_id=str(self.expert.id))

        resource_token = resource_context.set(str(self.visitor.id))
        case_token = selected_case_context.set(case["id"])
        try:
            result = async_to_sync(get_test_result_details.entrypoint)(run_context, assigned["id"])
        finally:
            resource_context.reset(resource_token)
            selected_case_context.reset(case_token)

        payload = json.loads(result.content)
        self.assertEqual(payload["source"], "interactive")
        self.assertEqual(payload["interactive_result"]["json"]["summary"], "نتیجه قابل خواندن توسط ابزار")

    def test_full_assignment_taking_history_and_agent_read_flow_for_multiple_tests(self):
        self._rule(41, "تست تعاملی اول", allow_visitors=False, allow_experts=True)
        self._rule(42, "تست تعاملی دوم", allow_visitors=False, allow_experts=True)
        TreatmentConnection.objects.create(
            doctor=self.expert,
            patient=self.visitor,
            status=TreatmentConnection.Status.ACTIVE,
        )
        case = CaseService.create_case(self.visitor, self.expert, title="پرونده کامل")
        run_context = RunContext(run_id="agent-flow-run", session_id="agent-flow-session", user_id=str(self.expert.id))

        async def fake_refresh(*args, **kwargs):
            return "canvas refreshed"

        async def collect(action, data=None):
            generator = await manage_clinical_tests.entrypoint(run_context, action=action, data=data)
            return [item async for item in generator]

        resource_token = resource_context.set(str(self.visitor.id))
        case_token = selected_case_context.set(case["id"])
        try:
            with patch("capabilities.vania_expert.tools._emit_canvas_refresh", new=fake_refresh):
                async_to_sync(collect)("ADD_TEST", {"source": "interactive", "interactive_test_id": 41})
                async_to_sync(collect)("ADD_TEST", {"source": "interactive", "interactive_test_id": 42})
        finally:
            resource_context.reset(resource_token)
            selected_case_context.reset(case_token)

        self.client.force_authenticate(self.visitor)
        visitor_list = self.client.get(
            "/api/vania/tests/",
            HTTP_X_TARGET_EXPERT_ID=str(self.expert.id),
            HTTP_X_TARGET_DOCTOR_ID=str(self.expert.id),
            HTTP_X_TARGET_CASE_ID=case["id"],
        )
        self.assertEqual(visitor_list.status_code, 200)
        self.assertEqual(len(visitor_list.data["tests"]), 2)
        by_interactive_id = {item["interactive_test_id"]: item for item in visitor_list.data["tests"]}
        self.assertEqual(by_interactive_id[41]["interactive_status"], "ASSIGNED")
        self.assertEqual(by_interactive_id[42]["interactive_status"], "ASSIGNED")

        def questionnaire_for(test_id):
            return self._alternate_questionnaire() if test_id == 42 else self._questionnaire()

        with (
            patch("vania_core.esanj_views.EsanjClient") as client_class,
            patch("vania_core.esanj_views.ensure_esanj_employee", return_value=SimpleNamespace(employee_id=7001)),
        ):
            esanj = client_class.return_value
            esanj.questionnaire.side_effect = questionnaire_for
            esanj.submit_interpretation.side_effect = lambda test_id, uuid, answers_payload, employee_id=None: {
                "summary": f"نتیجه تست {test_id}",
                "answers_payload": answers_payload,
            }
            esanj.get_grading.side_effect = lambda uuid: {"uuid": uuid}

            first_start = self.client.post(
                "/api/vania/esanj/attempts/",
                {
                    "clinical_test_id": by_interactive_id[41]["id"],
                    "doctor_id": self.expert.id,
                    "case_id": case["id"],
                    "age": 29,
                    "sex": "female",
                },
                format="json",
            )
            self.assertEqual(first_start.status_code, 201)

            resumed = self.client.post(
                "/api/vania/esanj/attempts/",
                {
                    "clinical_test_id": by_interactive_id[41]["id"],
                    "doctor_id": self.expert.id,
                    "case_id": case["id"],
                    "age": 29,
                    "sex": "female",
                },
                format="json",
            )
            self.assertEqual(resumed.status_code, 200)
            self.assertEqual(resumed.data["id"], first_start.data["id"])

            mid_history = self.client.get(
                "/api/vania/tests/",
                HTTP_X_TARGET_EXPERT_ID=str(self.expert.id),
                HTTP_X_TARGET_DOCTOR_ID=str(self.expert.id),
                HTTP_X_TARGET_CASE_ID=case["id"],
            )
            mid_first = next(item for item in mid_history.data["tests"] if item["interactive_test_id"] == 41)
            self.assertEqual(mid_first["interactive_status"], EsanjTestAttempt.Status.IN_PROGRESS)
            self.assertEqual(mid_first["interactive_attempt_id"], first_start.data["id"])

            first_submit = self.client.post(
                f"/api/vania/esanj/attempts/{first_start.data['id']}/submit/",
                {"answers": {"1": "1", "2": "0"}},
                format="json",
            )
            self.assertEqual(first_submit.status_code, 200)
            self.assertEqual(first_submit.data["result"]["json"]["answers_payload"]["q1"], 1)

            second_start = self.client.post(
                "/api/vania/esanj/attempts/",
                {
                    "clinical_test_id": by_interactive_id[42]["id"],
                    "doctor_id": self.expert.id,
                    "case_id": case["id"],
                    "age": 29,
                    "sex": "female",
                },
                format="json",
            )
            self.assertEqual(second_start.status_code, 201)
            self.assertEqual(second_start.data["questions_count"], 3)

            second_save = self.client.patch(
                f"/api/vania/esanj/attempts/{second_start.data['id']}/",
                {"answers": {"10": "3", "20": "8"}},
                format="json",
            )
            self.assertEqual(second_save.status_code, 200)
            self.assertEqual(second_save.data["progress"], {"answered": 2, "total": 3})

            second_submit = self.client.post(
                f"/api/vania/esanj/attempts/{second_start.data['id']}/submit/",
                {"answers": {"30": "12"}},
                format="json",
            )
            self.assertEqual(second_submit.status_code, 200)
            self.assertEqual(second_submit.data["result"]["json"]["answers_payload"]["q10"], 3)
            self.assertEqual(second_submit.data["result"]["json"]["answers_payload"]["q30"], 12)

        final_history = self.client.get(
            "/api/vania/tests/",
            HTTP_X_TARGET_EXPERT_ID=str(self.expert.id),
            HTTP_X_TARGET_DOCTOR_ID=str(self.expert.id),
            HTTP_X_TARGET_CASE_ID=case["id"],
        )
        self.assertEqual(final_history.status_code, 200)
        final_by_interactive_id = {item["interactive_test_id"]: item for item in final_history.data["tests"]}
        self.assertEqual(final_by_interactive_id[41]["interactive_status"], EsanjTestAttempt.Status.COMPLETED)
        self.assertEqual(final_by_interactive_id[42]["interactive_status"], EsanjTestAttempt.Status.COMPLETED)
        self.assertIn("نتیجه تست 41", final_by_interactive_id[41]["result_text"])
        self.assertIn("نتیجه تست 42", final_by_interactive_id[42]["result_text"])

        resource_token = resource_context.set(str(self.visitor.id))
        case_token = selected_case_context.set(case["id"])
        try:
            first_result = async_to_sync(get_test_result_details.entrypoint)(run_context, by_interactive_id[41]["id"])
            second_result = async_to_sync(get_test_result_details.entrypoint)(run_context, by_interactive_id[42]["id"])
        finally:
            resource_context.reset(resource_token)
            selected_case_context.reset(case_token)

        first_payload = json.loads(first_result.content)
        second_payload = json.loads(second_result.content)
        self.assertEqual(first_payload["interactive_result"]["json"]["summary"], "نتیجه تست 41")
        self.assertEqual(second_payload["interactive_result"]["json"]["summary"], "نتیجه تست 42")

    def test_visitor_agent_reads_interactive_result_and_cannot_overwrite_it_manually(self):
        rule = self._rule(51, "تست نتیجه مراجع", allow_visitors=False, allow_experts=True)
        TreatmentConnection.objects.create(
            doctor=self.expert,
            patient=self.visitor,
            status=TreatmentConnection.Status.ACTIVE,
        )
        case = CaseService.create_case(self.visitor, self.expert, title="پرونده مراجع")
        assigned = ClinicalTestsService.add_test(
            patient=self.visitor,
            created_by=self.expert,
            title=rule.title,
            doctor_id=self.expert.id,
            case_id=case["id"],
            source="interactive",
            interactive_test_id=rule.esanj_test_id,
        )
        attempt = EsanjTestAttempt.objects.create(
            user=self.visitor,
            access_rule=rule,
            clinical_test_id=assigned["id"],
            assigned_by=self.expert,
            doctor_id=self.expert.id,
            case_id=case["id"],
            esanj_test_id=rule.esanj_test_id,
            test_title=rule.title,
            status=EsanjTestAttempt.Status.COMPLETED,
            age=30,
            sex=EsanjTestAttempt.Sex.FEMALE,
            questionnaire=self._questionnaire(),
            answers={"1": "1", "2": "0"},
            result_json={"summary": "نتیجه قابل خواندن توسط مراجع"},
            grading_json={"score": 1},
        )
        ClinicalTestsService.update_interactive_assignment_from_attempt(self.visitor, attempt, creator=self.visitor)
        run_context = RunContext(run_id="visitor-agent-flow", session_id="visitor-agent-session", user_id=str(self.visitor.id))

        case_token = selected_case_context.set(case["id"])
        try:
            result = async_to_sync(get_my_test_result_details.entrypoint)(run_context, assigned["id"])

            async def collect_update():
                generator = await update_my_test_result.entrypoint(run_context, assigned["id"], "manual override")
                return [item async for item in generator]

            update_output = async_to_sync(collect_update)()
        finally:
            selected_case_context.reset(case_token)

        payload = json.loads(result.content)
        self.assertEqual(payload["source"], "interactive")
        self.assertEqual(payload["interactive_result"]["json"]["summary"], "نتیجه قابل خواندن توسط مراجع")
        self.assertIn("تست تعاملی", update_output[0])
