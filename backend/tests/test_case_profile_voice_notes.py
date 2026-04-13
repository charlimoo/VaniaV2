import os
import shutil
import tempfile

from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import CustomUser, ExpertProfession, UserRole
from vania_core.case_service import CaseService
from vania_core.models import TreatmentConnection
from vania_core.services import ProfileService


TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="vania_voice_notes_test_")


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class CaseProfileVoiceNotesTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        if TEST_MEDIA_ROOT and os.path.isdir(TEST_MEDIA_ROOT):
            shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.client = APIClient()
        self.expert_role = UserRole.objects.create(name="متخصص", slug="expert")
        self.visitor_role = UserRole.objects.create(name="مراجع", slug="visitor")
        self.psychologist = ExpertProfession.objects.create(slug="psychologist", name="روانشناس")

        self.owner = CustomUser.objects.create_user(
            phone_number="09130000001",
            role=self.expert_role,
            full_name="Owner",
            expert_profession=self.psychologist,
            is_expert_verified=True,
        )
        self.shared_reader = CustomUser.objects.create_user(
            phone_number="09130000002",
            role=self.expert_role,
            full_name="Reader",
            expert_profession=self.psychologist,
            is_expert_verified=True,
        )
        self.outsider = CustomUser.objects.create_user(
            phone_number="09130000003",
            role=self.expert_role,
            full_name="Outsider",
            expert_profession=self.psychologist,
            is_expert_verified=True,
        )
        self.visitor = CustomUser.objects.create_user(
            phone_number="09140000001",
            role=self.visitor_role,
            full_name="Visitor",
        )

        TreatmentConnection.objects.create(
            doctor=self.owner,
            patient=self.visitor,
            status=TreatmentConnection.Status.ACTIVE,
        )
        TreatmentConnection.objects.create(
            doctor=self.shared_reader,
            patient=self.visitor,
            status=TreatmentConnection.Status.ACTIVE,
        )
        self.case = CaseService.create_case(self.visitor, self.owner, "پرونده تست صوت")

    def _upload_note(self, user):
        self.client.force_authenticate(user)
        payload = {
            "patient_id": self.visitor.id,
            "case_id": self.case["id"],
            "duration_seconds": "9.5",
            "file": SimpleUploadedFile("note.webm", b"voice-bytes", content_type="audio/webm"),
        }
        return self.client.post("/api/vania/case-profile/", payload)

    def test_profile_service_voice_note_methods_store_and_delete_file(self):
        file_obj = SimpleUploadedFile("service-note.webm", b"service-voice", content_type="audio/webm")
        note = ProfileService.add_summary_voice_note(
            patient=self.visitor,
            uploaded_file=file_obj,
            doctor_id=self.owner.id,
            case_id=self.case["id"],
            uploaded_by_user_id=self.owner.id,
            duration_seconds=7.2,
            creator=self.owner,
        )

        notes = ProfileService.get_summary_voice_notes(self.visitor, doctor_id=self.owner.id, case_id=self.case["id"])
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]["id"], note["id"])
        self.assertAlmostEqual(notes[0]["duration_seconds"], 7.2)
        self.assertTrue(default_storage.exists(note["storage_path"]))

        deleted = ProfileService.delete_summary_voice_note(
            patient=self.visitor,
            voice_note_id=note["id"],
            doctor_id=self.owner.id,
            case_id=self.case["id"],
            creator=self.owner,
        )
        self.assertTrue(deleted)
        self.assertEqual(
            ProfileService.get_summary_voice_notes(self.visitor, doctor_id=self.owner.id, case_id=self.case["id"]),
            [],
        )
        self.assertFalse(default_storage.exists(note["storage_path"]))

    def test_owner_can_upload_and_delete_voice_note(self):
        create_response = self._upload_note(self.owner)
        self.assertEqual(create_response.status_code, 201)
        created_payload = create_response.json()
        self.assertIn("summary_voice_notes", created_payload)
        self.assertEqual(len(created_payload["summary_voice_notes"]), 1)
        note = created_payload["summary_voice_notes"][0]
        self.assertTrue(default_storage.exists(note["storage_path"]))

        self.client.force_authenticate(self.owner)
        delete_response = self.client.delete(
            "/api/vania/case-profile/",
            {
                "patient_id": self.visitor.id,
                "case_id": self.case["id"],
                "voice_note_id": note["id"],
            },
            format="json",
        )
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()["summary_voice_notes"], [])
        self.assertFalse(default_storage.exists(note["storage_path"]))

    def test_read_only_expert_cannot_upload_or_delete_voice_note(self):
        self.client.force_authenticate(self.visitor)
        share_res = self.client.post(
            f"/api/vania/cases/{self.case['id']}/shares/",
            {"expert_id": self.shared_reader.id},
            format="json",
        )
        self.assertEqual(share_res.status_code, 201)

        owner_create = self._upload_note(self.owner)
        self.assertEqual(owner_create.status_code, 201)
        note_id = owner_create.json()["summary_voice_notes"][0]["id"]

        reader_create = self._upload_note(self.shared_reader)
        self.assertEqual(reader_create.status_code, 403)

        self.client.force_authenticate(self.shared_reader)
        reader_delete = self.client.delete(
            "/api/vania/case-profile/",
            {
                "patient_id": self.visitor.id,
                "case_id": self.case["id"],
                "voice_note_id": note_id,
            },
            format="json",
        )
        self.assertEqual(reader_delete.status_code, 403)

    def test_wrong_expert_access_is_blocked(self):
        self.client.force_authenticate(self.outsider)

        get_response = self.client.get(
            "/api/vania/case-profile/",
            {"patient_id": self.visitor.id, "case_id": self.case["id"]},
        )
        self.assertEqual(get_response.status_code, 403)

        create_response = self.client.post(
            "/api/vania/case-profile/",
            {
                "patient_id": self.visitor.id,
                "case_id": self.case["id"],
                "duration_seconds": "2",
                "file": SimpleUploadedFile("blocked.webm", b"audio", content_type="audio/webm"),
            },
        )
        self.assertEqual(create_response.status_code, 403)

    def test_owner_can_download_voice_note_for_draft_case(self):
        draft_case_id = "draft-1775932624382"
        file_obj = SimpleUploadedFile("draft-note.webm", b"draft-audio", content_type="audio/webm")
        note = ProfileService.add_summary_voice_note(
            patient=self.visitor,
            uploaded_file=file_obj,
            doctor_id=self.owner.id,
            case_id=draft_case_id,
            uploaded_by_user_id=self.owner.id,
            duration_seconds=3.1,
            creator=self.owner,
        )

        self.client.force_authenticate(self.owner)
        response = self.client.get(
            f"/api/vania/case-profile/voice-notes/{note['id']}/download/",
            {"patient_id": self.visitor.id, "case_id": draft_case_id},
        )
        self.assertEqual(response.status_code, 200)
