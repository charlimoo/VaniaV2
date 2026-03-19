# backend/vania_core/services.py
import uuid
import logging
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from typing import Optional
# --- App Imports ---
from users.services import user_context_manager
from users.models import CustomUser, UserContextEntry, UserRole
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
        phone = phone_number.strip()
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
