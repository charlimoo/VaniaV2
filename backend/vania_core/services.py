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
from .tests_service import ClinicalTestsService
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
        Tries to activate a connection while enforcing one-active-doctor rule.
        Returns (activated, activation_locked).
        """
        locked = PatientManagementService.is_activation_locked(
            patient=connection.patient,
            current_doctor=connection.doctor
        )
        connection.status = (
            TreatmentConnection.Status.ARCHIVED
            if locked
            else TreatmentConnection.Status.ACTIVE
        )
        connection.save(update_fields=["status", "updated_at"])
        return (not locked), locked

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
                        patient_role = UserRole.objects.get(slug="patient")
                        patient.role = patient_role
                    except UserRole.DoesNotExist:
                        logger.warning("Default 'patient' role not found during user creation.")
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
                    if locked:
                        message = "حساب ایجاد شد و بیمار به صورت غیرفعال اضافه شد."
                    else:
                        message = f"حساب کاربری برای «{initial_name}» ایجاد و به لیست شما اضافه شد."
                elif conn_created:
                    if locked:
                        message = "بیمار به لیست شما اضافه شد اما فعلا غیرفعال است."
                    else:
                        message = f"بیمار «{patient.full_name or patient.phone_number}» به لیست شما اضافه شد."
                else:
                    if activated:
                        message = "ارتباط این بیمار با شما فعال شد."
                    else:
                        message = "این بیمار در لیست شما موجود است اما فعلا به صورت غیرفعال می‌ماند."

                return True, message, patient, conn.status, locked
        except Exception as e:
            logger.error(f"Error in invite_patient_by_phone for Dr {doctor_user.id} -> {phone}: {e}")
            return False, "خطای داخلی در سرور هنگام افزودن بیمار.", None, None, False

class ProfileService:
    """ Manages the patient's core profile summary (demographics, story, etc.) """
    CONTEXT_KEY = "clinical_summary"
    DEMOGRAPHICS_KEY = "patient_demographics"
    FORMS_TESTS_ANALYSIS_KEY = "forms_tests_clinical_analysis"

    @staticmethod
    def get_summary(patient: CustomUser) -> str:
        """ Retrieves the clinical summary text for a patient. """
        entry = user_context_manager.get_context(patient, ProfileService.CONTEXT_KEY)
        # Return the text content, or a default placeholder if none exists
        return entry.data.get("summary_text", "") if entry else ""

    @staticmethod
    def update_summary(patient: CustomUser, summary_text: str):
        """ Updates or creates the clinical summary for a patient. """
        user_context_manager.set_singleton_context(
            user=patient,
            key=ProfileService.CONTEXT_KEY,
            data={"summary_text": summary_text},
            source=UserContextEntry.SourceType.AGENT  # Can be AGENT or USER
        )

    @staticmethod
    def get_demographics(patient: CustomUser) -> dict:
        """ Returns the permanent demographic profile of the patient. """
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
    def update_demographics(patient: CustomUser, data: dict):
        """ Persists demographics to the DB permanently. """
        # We also sync the name to the primary CustomUser model for consistency
        if 'name' in data and data['name']:
            patient.full_name = data['name']
            patient.save(update_fields=['full_name'])

        user_context_manager.set_singleton_context(
            user=patient,
            key=ProfileService.DEMOGRAPHICS_KEY,
            data=data,
            source=UserContextEntry.SourceType.USER
        )

    @staticmethod
    def get_forms_tests_analysis(patient: CustomUser) -> str:
        entry = user_context_manager.get_context(patient, ProfileService.FORMS_TESTS_ANALYSIS_KEY)
        return entry.data.get("analysis_text", "") if entry else ""

    @staticmethod
    def update_forms_tests_analysis(patient: CustomUser, analysis_text: str):
        user_context_manager.set_singleton_context(
            user=patient,
            key=ProfileService.FORMS_TESTS_ANALYSIS_KEY,
            data={"analysis_text": analysis_text},
            source=UserContextEntry.SourceType.AGENT,
        )
