from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from unittest.mock import patch

from users.models import CustomUser, ExpertProfession, UserRole
from capabilities.test_attachment_media import build_case_file_tool_result, build_test_attachment_tool_result
from vania_core.case_service import CaseService
from vania_core.models import TreatmentConnection
from vania_core.patient_service import PatientDataService
from vania_core.case_files_service import CaseFilesService
from vania_core.tests_service import ClinicalTestsService


class CasePermissionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.expert_role = UserRole.objects.create(name="متخصص", slug="expert")
        self.visitor_role = UserRole.objects.create(name="مراجعه‌کننده", slug="visitor")
        self.psychologist = ExpertProfession.objects.create(slug="psychologist", name="روانشناس")
        self.lawyer = ExpertProfession.objects.create(slug="lawyer", name="وکیل")

        self.owner = CustomUser.objects.create_user(
            phone_number="1000000001",
            role=self.expert_role,
            full_name="Owner Expert",
            expert_profession=self.psychologist,
            is_expert_verified=True,
        )
        self.shared_reader = CustomUser.objects.create_user(
            phone_number="1000000002",
            role=self.expert_role,
            full_name="Shared Reader",
            expert_profession=self.psychologist,
            is_expert_verified=True,
        )
        self.other_type_expert = CustomUser.objects.create_user(
            phone_number="1000000003",
            role=self.expert_role,
            full_name="Other Type",
            expert_profession=self.lawyer,
            is_expert_verified=True,
        )
        self.visitor = CustomUser.objects.create_user(
            phone_number="2000000001",
            role=self.visitor_role,
            full_name="Visitor User",
        )

        for expert in [self.owner, self.shared_reader, self.other_type_expert]:
            TreatmentConnection.objects.create(
                doctor=expert,
                patient=self.visitor,
                status=TreatmentConnection.Status.ACTIVE,
            )

        self.case = CaseService.create_case(self.visitor, self.owner, "پرونده اصلی")
        self.test_entry = ClinicalTestsService.add_test(
            patient=self.visitor,
            created_by=self.owner,
            title="Test A",
            result_summary="Initial result",
            doctor_id=self.owner.id,
            case_id=self.case["id"],
        )

    def test_shared_case_is_visible_read_only_and_visitor_snapshot_has_profession(self):
        self.client.force_authenticate(self.visitor)
        share_response = self.client.post(
            f"/api/vania/cases/{self.case['id']}/shares/",
            {"expert_id": self.shared_reader.id},
            format="json",
        )
        self.assertEqual(share_response.status_code, 201)

        visitor_snapshot = PatientDataService.get_patient_dashboard_snapshot(self.visitor, case_id=self.case["id"])
        self.assertEqual(visitor_snapshot["cases"][0]["doctor_profession_label"], "روانشناس")

        accessible_for_reader = CaseService.get_accessible_cases_for_expert(self.visitor, self.shared_reader)
        shared_case = next(item for item in accessible_for_reader if item["id"] == self.case["id"])
        self.assertTrue(shared_case["is_read_only"])
        self.assertFalse(shared_case["can_edit"])

    def test_visitor_can_only_share_with_same_profession(self):
        self.client.force_authenticate(self.visitor)
        response = self.client.post(
            f"/api/vania/cases/{self.case['id']}/shares/",
            {"expert_id": self.other_type_expert.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("same type", response.json()["error"])

    def test_shared_expert_can_read_but_cannot_modify_case_tests(self):
        self.client.force_authenticate(self.visitor)
        self.client.post(
            f"/api/vania/cases/{self.case['id']}/shares/",
            {"expert_id": self.shared_reader.id},
            format="json",
        )

        self.client.force_authenticate(self.shared_reader)
        get_response = self.client.get(
            "/api/vania/tests/",
            {"patient_id": self.visitor.id, "case_id": self.case["id"]},
        )
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(len(get_response.json()["tests"]), 1)

        put_response = self.client.put(
            f"/api/vania/tests/{self.test_entry['id']}/",
            {
                "patient_id": self.visitor.id,
                "case_id": self.case["id"],
                "result_text": "mutated",
            },
            format="json",
        )
        self.assertEqual(put_response.status_code, 403)

    @patch("vania_core.case_files_service.CaseFilesService.extract_file")
    def test_read_test_result_bundle_uses_shared_file_extraction_shape(self, mock_extract_file):
        mock_extract_file.return_value = {
            "status": "READY",
            "text_stats": {
                "readable": True,
                "total_chars": 32,
                "total_chunks": 1,
                "total_pages": 1,
            },
            "content": {
                "pages": [
                    {"page_number": 1, "text": "CBC result: hemoglobin normal"},
                ],
                "chunks": [
                    {"chunk_index": 0, "page_number": 1, "text": "CBC result: hemoglobin normal"},
                ],
            },
        }
        uploaded = SimpleUploadedFile("cbc.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        ClinicalTestsService.attach_test_file(
            patient=self.visitor,
            created_by=self.owner,
            test_id=self.test_entry["id"],
            uploaded_file=uploaded,
            doctor_id=self.owner.id,
            case_id=self.case["id"],
        )

        payload = ClinicalTestsService.read_test_result_bundle(
            self.visitor,
            self.test_entry["id"],
            self.owner.id,
            self.case["id"],
        )

        self.assertIsNotNone(payload)
        self.assertEqual(len(payload["attachments"]), 1)
        attachment = payload["attachments"][0]
        self.assertEqual(attachment["extraction_status"], "READY")
        self.assertEqual(attachment["text_stats"]["total_pages"], 1)
        self.assertEqual(attachment["pages"][0]["text"], "CBC result: hemoglobin normal")
        self.assertIn("hemoglobin normal", attachment["extracted_text"])

    def test_test_attachment_tool_result_loads_original_media(self):
        pdf_upload = SimpleUploadedFile("cbc.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        png_upload = SimpleUploadedFile("scan.png", b"\x89PNG\r\n\x1a\nfake", content_type="image/png")
        ClinicalTestsService.attach_test_file(
            patient=self.visitor,
            created_by=self.owner,
            test_id=self.test_entry["id"],
            uploaded_file=pdf_upload,
            doctor_id=self.owner.id,
            case_id=self.case["id"],
        )
        ClinicalTestsService.attach_test_file(
            patient=self.visitor,
            created_by=self.owner,
            test_id=self.test_entry["id"],
            uploaded_file=png_upload,
            doctor_id=self.owner.id,
            case_id=self.case["id"],
        )

        test_record = ClinicalTestsService.get_test(
            self.visitor,
            self.test_entry["id"],
            self.owner.id,
            self.case["id"],
        )
        tool_result = build_test_attachment_tool_result(test_record)
        payload = tool_result.model_dump()

        self.assertIsNotNone(tool_result.files)
        self.assertIsNotNone(tool_result.images)
        self.assertEqual(tool_result.files[0].filename, "cbc.pdf")
        self.assertEqual(tool_result.files[0].mime_type, "application/pdf")
        self.assertEqual(tool_result.images[0].mime_type, "image/png")
        self.assertIn("Only attachments with loaded_into_context=true", payload["content"])

        pdf_attachment_id = next(
            item["id"]
            for item in test_record["attachments"]
            if item["content_type"] == "application/pdf"
        )
        pdf_only_result = build_test_attachment_tool_result(test_record, attachment_id=pdf_attachment_id)
        self.assertIsNotNone(pdf_only_result.files)
        self.assertIsNone(pdf_only_result.images)

    def test_case_file_tool_result_loads_original_media(self):
        pdf_upload = SimpleUploadedFile("case-note.pdf", b"%PDF-1.4 case note", content_type="application/pdf")
        png_upload = SimpleUploadedFile("scan.png", b"\x89PNG\r\n\x1a\nfake", content_type="image/png")

        pdf_file = CaseFilesService.create_file(
            patient=self.visitor,
            created_by=self.owner,
            doctor_id=self.owner.id,
            case_id=self.case["id"],
            uploaded_file=pdf_upload,
            name="Case Note",
            description="PDF file",
        )
        png_file = CaseFilesService.create_file(
            patient=self.visitor,
            created_by=self.owner,
            doctor_id=self.owner.id,
            case_id=self.case["id"],
            uploaded_file=png_upload,
            name="Scan",
            description="Image file",
        )

        pdf_result = build_case_file_tool_result(pdf_file)
        pdf_payload = pdf_result.model_dump()
        self.assertIsNotNone(pdf_result.files)
        self.assertIsNone(pdf_result.images)
        self.assertEqual(pdf_result.files[0].filename, "case-note.pdf")
        self.assertEqual(pdf_result.files[0].mime_type, "application/pdf")
        self.assertIn("loaded_into_context", pdf_payload["content"])

        png_read_payload = CaseFilesService.read_file(
            self.visitor,
            self.owner.id,
            self.case["id"],
            png_file["id"],
        )
        png_result = build_case_file_tool_result(png_file, payload=png_read_payload)
        self.assertIsNone(png_result.files)
        self.assertIsNotNone(png_result.images)
        self.assertEqual(png_result.images[0].mime_type, "image/png")
