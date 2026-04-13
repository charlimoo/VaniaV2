# backend/vania_core/services.py
import uuid
import logging
import os
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from typing import Optional
# --- App Imports ---
from users.services import user_context_manager
from users.models import CustomUser, UserContextEntry, UserRole
from users.phone_utils import normalize_and_validate_phone_number
from users.sms_service import sms_service
from .models import Notification, TreatmentConnection, PatientInvite
from .schemas import (
    TherapyRoadmap, RoadmapSession, TherapyPhase, SessionStatus,
    ThoughtAppendix, CulturalResource,
    RescueNetState, RescueTask, RescueDimension
)
from .task_service import TaskService
from .session_service import SessionService
from .roadmap_service import RoadmapService
from .appendix_service import AppendixService
from .medication_service import MedicationService
from .tests_service import ClinicalTestsService
from .case_files_service import CaseFilesService
from .context_scope import migrate_legacy_to_scoped_once, migrate_doctor_scoped_to_case_once, build_scoped_key
from .case_service import build_case_scoped_key
# Configure Logger for this module
logger = logging.getLogger(__name__)

# ==============================================================================
# == 3. PATIENT MANAGEMENT SERVICE (Existing Logic)
# ==============================================================================

class PatientManagementService:
    """
    Encapsulates the logic for doctors adding, inviting, and managing patients.
    """

    @staticmethod
    def is_activation_locked(
        patient: CustomUser,
        current_doctor: Optional[CustomUser] = None
    ) -> bool:
        """
        Returns True when the patient is ACTIVE with another doctor.
        """
        qs = TreatmentConnection.objects.filter(
            patient=patient,
            status=TreatmentConnection.Status.ACTIVE
        )
        if current_doctor:
            qs = qs.exclude(doctor=current_doctor)
        return qs.exists()

    @staticmethod
    def activate_connection_or_lock(connection: TreatmentConnection) -> tuple[bool, bool]:
        """
        Activates a connection.
        Returns (activated, activation_locked) for backward compatibility.
        """
        locked = False
        connection.status = TreatmentConnection.Status.ACTIVE
        connection.save(update_fields=["status", "updated_at"])
        return True, locked

    @staticmethod
    def invite_patient_by_phone(
        doctor_user: CustomUser,
        phone_number: str,
        full_name: str = None
    ) -> tuple[bool, str, Optional[CustomUser], Optional[str], bool]:
        """
        Adds or links a patient to doctor list and enforces active uniqueness.
        Returns (success, message, patient_object, connection_status, activation_locked).
        """
        try:
            phone = normalize_and_validate_phone_number(phone_number)
        except DjangoValidationError as exc:
            return False, exc.messages[0], None, None, False
        initial_name = full_name.strip() if full_name and full_name.strip() else "کاربر جدید"

        try:
            with transaction.atomic():
                patient, created = CustomUser.objects.get_or_create(
                    phone_number=phone,
                    defaults={"full_name": initial_name, "is_active": True}
                )

                if created:
                    patient.set_unusable_password()
                    try:
                        patient_role = UserRole.objects.get(slug="visitor")
                        patient.role = patient_role
                    except UserRole.DoesNotExist:
                        logger.warning("Default 'visitor' role not found during user creation.")
                    patient.save()

                if full_name and full_name.strip() and not (patient.full_name or "").strip():
                    patient.full_name = full_name.strip()
                    patient.save(update_fields=["full_name"])

                conn, conn_created = TreatmentConnection.objects.get_or_create(
                    doctor=doctor_user,
                    patient=patient,
                    defaults={"status": TreatmentConnection.Status.ARCHIVED}
                )
                activated, locked = PatientManagementService.activate_connection_or_lock(conn)

                if created:
                    message = f"حساب کاربری برای «{initial_name}» ایجاد و به لیست شما اضافه شد."
                elif conn_created:
                    message = f"مراجع «{patient.full_name or patient.phone_number}» به لیست شما اضافه شد."
                else:
                    if activated:
                        message = "ارتباط این مراجع با شما فعال شد."
                    else:
                        message = "این مراجع در لیست شما موجود است اما فعلا به صورت غیرفعال می‌ماند."

                return True, message, patient, conn.status, locked
        except Exception as e:
            logger.error(f"Error in invite_patient_by_phone for Dr {doctor_user.id} -> {phone}: {e}")
            return False, "خطای داخلی در سرور هنگام افزودن مراجع.", None, None, False

class ProfileService:
    """ Manages the patient's core profile summary (demographics, story, etc.) """
    CONTEXT_KEY = "clinical_summary"
    DEMOGRAPHICS_KEY = "patient_demographics"
    FORMS_TESTS_ANALYSIS_KEY = "forms_tests_clinical_analysis"
    SUMMARY_VOICE_NOTES_KEY = "clinical_summary_voice_notes"

    @staticmethod
    def _summary_voice_notes_context_key(doctor_id: int | None = None, case_id: str | None = None) -> str:
        if doctor_id and case_id:
            return build_case_scoped_key(ProfileService.SUMMARY_VOICE_NOTES_KEY, doctor_id, case_id)
        if doctor_id:
            return build_scoped_key(ProfileService.SUMMARY_VOICE_NOTES_KEY, doctor_id)
        return ProfileService.SUMMARY_VOICE_NOTES_KEY

    @staticmethod
    def _normalize_voice_note(note: dict) -> dict:
        payload = dict(note or {})
        payload["id"] = str(payload.get("id") or uuid.uuid4().hex)
        payload["file_name"] = payload.get("file_name") or "voice-note.webm"
        payload["storage_path"] = payload.get("storage_path") or ""
        payload["content_type"] = payload.get("content_type") or "audio/webm"
        payload["size_bytes"] = int(payload.get("size_bytes") or 0)
        payload["duration_seconds"] = float(payload.get("duration_seconds") or 0.0)
        payload["created_at"] = payload.get("created_at") or timezone.now().isoformat()
        payload["uploaded_by_user_id"] = int(payload.get("uploaded_by_user_id") or 0)
        return payload

    @staticmethod
    def get_summary(patient: CustomUser, doctor_id: int | None = None, case_id: str | None = None) -> str:
        """ Retrieves the clinical summary text for a patient. """
        key = ProfileService.CONTEXT_KEY
        if doctor_id and case_id:
            entry = migrate_doctor_scoped_to_case_once(
                patient=patient,
                doctor_id=doctor_id,
                case_id=case_id,
                base_key=ProfileService.CONTEXT_KEY,
                default_factory=lambda: {"summary_text": ""},
            )
        elif doctor_id:
            entry = migrate_legacy_to_scoped_once(
                patient=patient,
                doctor_id=doctor_id,
                base_key=ProfileService.CONTEXT_KEY,
                default_factory=lambda: {"summary_text": ""},
            )
        else:
            entry = user_context_manager.get_context(patient, key)
        # Return the text content, or a default placeholder if none exists
        return entry.data.get("summary_text", "") if entry else ""

    @staticmethod
    def update_summary(patient: CustomUser, summary_text: str, doctor_id: int | None = None, case_id: str | None = None):
        """ Updates or creates the clinical summary for a patient. """
        key = build_case_scoped_key(ProfileService.CONTEXT_KEY, doctor_id, case_id) if doctor_id and case_id else build_scoped_key(ProfileService.CONTEXT_KEY, doctor_id) if doctor_id else ProfileService.CONTEXT_KEY
        user_context_manager.set_singleton_context(
            user=patient,
            key=key,
            data={"summary_text": summary_text},
            source=UserContextEntry.SourceType.AGENT  # Can be AGENT or USER
        )

    @staticmethod
    def get_demographics(patient: CustomUser, doctor_id: int | None = None) -> dict:
        """ Returns the permanent demographic profile of the patient. """
        if doctor_id:
            entry = migrate_legacy_to_scoped_once(
                patient=patient,
                doctor_id=doctor_id,
                base_key=ProfileService.DEMOGRAPHICS_KEY,
                default_factory=lambda: {
                    "name": patient.full_name or "",
                    "age": "",
                    "marital_status": "single",
                    "education": "bachelor",
                    "job": ""
                },
            )
        else:
            entry = user_context_manager.get_context(patient, ProfileService.DEMOGRAPHICS_KEY)
        if entry:
            return entry.data
        return {
            "name": patient.full_name or "",
            "age": "",
            "marital_status": "single",
            "education": "bachelor",
            "job": ""
        }

    @staticmethod
    def update_demographics(patient: CustomUser, data: dict, doctor_id: int | None = None):
        """ Persists demographics to the DB permanently. """
        # We also sync the name to the primary CustomUser model for consistency
        if 'name' in data and data['name']:
            patient.full_name = data['name']
            patient.save(update_fields=['full_name'])

        key = build_scoped_key(ProfileService.DEMOGRAPHICS_KEY, doctor_id) if doctor_id else ProfileService.DEMOGRAPHICS_KEY
        user_context_manager.set_singleton_context(
            user=patient,
            key=key,
            data=data,
            source=UserContextEntry.SourceType.USER
        )

    @staticmethod
    def get_forms_tests_analysis(patient: CustomUser, doctor_id: int | None = None, case_id: str | None = None) -> str:
        if doctor_id and case_id:
            entry = migrate_doctor_scoped_to_case_once(
                patient=patient,
                doctor_id=doctor_id,
                case_id=case_id,
                base_key=ProfileService.FORMS_TESTS_ANALYSIS_KEY,
                default_factory=lambda: {"analysis_text": ""},
            )
        elif doctor_id:
            entry = migrate_legacy_to_scoped_once(
                patient=patient,
                doctor_id=doctor_id,
                base_key=ProfileService.FORMS_TESTS_ANALYSIS_KEY,
                default_factory=lambda: {"analysis_text": ""},
            )
        else:
            entry = user_context_manager.get_context(patient, ProfileService.FORMS_TESTS_ANALYSIS_KEY)
        return entry.data.get("analysis_text", "") if entry else ""

    @staticmethod
    def update_forms_tests_analysis(patient: CustomUser, analysis_text: str, doctor_id: int | None = None, case_id: str | None = None):
        key = build_case_scoped_key(ProfileService.FORMS_TESTS_ANALYSIS_KEY, doctor_id, case_id) if doctor_id and case_id else build_scoped_key(ProfileService.FORMS_TESTS_ANALYSIS_KEY, doctor_id) if doctor_id else ProfileService.FORMS_TESTS_ANALYSIS_KEY
        user_context_manager.set_singleton_context(
            user=patient,
            key=key,
            data={"analysis_text": analysis_text},
            source=UserContextEntry.SourceType.AGENT,
        )

    @staticmethod
    def get_summary_voice_notes(patient: CustomUser, doctor_id: int | None = None, case_id: str | None = None) -> list[dict]:
        key = ProfileService._summary_voice_notes_context_key(doctor_id, case_id)
        entry = user_context_manager.get_context(patient, key)
        if not entry or not isinstance(entry.data, dict):
            return []
        notes = entry.data.get("voice_notes", [])
        if not isinstance(notes, list):
            return []
        normalized = [ProfileService._normalize_voice_note(item) for item in notes if isinstance(item, dict)]
        normalized.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        return normalized

    @staticmethod
    def _save_summary_voice_notes(
        patient: CustomUser,
        notes: list[dict],
        doctor_id: int | None = None,
        case_id: str | None = None,
        creator: CustomUser | None = None,
    ):
        key = ProfileService._summary_voice_notes_context_key(doctor_id, case_id)
        user_context_manager.set_singleton_context(
            user=patient,
            key=key,
            data={"voice_notes": notes},
            source=UserContextEntry.SourceType.USER if creator else UserContextEntry.SourceType.SYSTEM,
            creator=creator,
        )

    @staticmethod
    def add_summary_voice_note(
        patient: CustomUser,
        uploaded_file,
        *,
        doctor_id: int | None = None,
        case_id: str | None = None,
        uploaded_by_user_id: int | None = None,
        duration_seconds: float = 0.0,
        creator: CustomUser | None = None,
    ) -> dict:
        extension = (os.path.splitext(uploaded_file.name or "")[1] or ".webm").lower()
        safe_name = f"{uuid.uuid4().hex}{extension}"
        relative_path = os.path.join("case_profile_voice_notes", str(patient.id), safe_name)
        file_content = uploaded_file.read()
        stored_path = default_storage.save(relative_path, ContentFile(file_content))
        note = ProfileService._normalize_voice_note(
            {
                "id": uuid.uuid4().hex,
                "file_name": uploaded_file.name or f"voice-note{extension}",
                "storage_path": stored_path,
                "content_type": getattr(uploaded_file, "content_type", None) or "audio/webm",
                "size_bytes": getattr(uploaded_file, "size", None) or len(file_content),
                "duration_seconds": duration_seconds,
                "created_at": timezone.now().isoformat(),
                "uploaded_by_user_id": int(uploaded_by_user_id or 0),
            }
        )
        notes = ProfileService.get_summary_voice_notes(patient, doctor_id=doctor_id, case_id=case_id)
        notes = [note, *notes]
        ProfileService._save_summary_voice_notes(
            patient,
            notes,
            doctor_id=doctor_id,
            case_id=case_id,
            creator=creator,
        )
        return note

    @staticmethod
    def delete_summary_voice_note(
        patient: CustomUser,
        voice_note_id: str,
        *,
        doctor_id: int | None = None,
        case_id: str | None = None,
        creator: CustomUser | None = None,
    ) -> bool:
        notes = ProfileService.get_summary_voice_notes(patient, doctor_id=doctor_id, case_id=case_id)
        remaining: list[dict] = []
        removed_note: dict | None = None
        for item in notes:
            if item.get("id") == voice_note_id:
                removed_note = item
                continue
            remaining.append(item)
        if removed_note is None:
            return False

        storage_path = removed_note.get("storage_path")
        if storage_path and default_storage.exists(storage_path):
            default_storage.delete(storage_path)

        ProfileService._save_summary_voice_notes(
            patient,
            remaining,
            doctor_id=doctor_id,
            case_id=case_id,
            creator=creator,
        )
        return True
