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
# Configure Logger for this module
logger = logging.getLogger(__name__)

# ==============================================================================
# == 3. PATIENT MANAGEMENT SERVICE (Existing Logic)
# ==============================================================================

class PatientManagementService:
    """
    Encapsulates the logic for Doctors adding, inviting, and managing patients.
    This service handles both creating new users and linking existing ones.
    """
    
    @staticmethod
    def invite_patient_by_phone(
        doctor_user: CustomUser, 
        phone_number: str, 
        full_name: str = None
    ) -> tuple[bool, str, Optional[CustomUser]]:
        """
        Adds a patient to the doctor's list. If the user does not exist, a new,
        inactive account is created, and an invite is sent. If they exist, a
        connection request is created.
        
        Returns:
            A tuple of (success, message, patient_object).
        """
        phone = phone_number.strip()
        initial_name = full_name.strip() if full_name and full_name.strip() else 'کاربر جدید'

        try:
            with transaction.atomic():
                # 1. Get or Create the User
                patient, created = CustomUser.objects.get_or_create(
                    phone_number=phone,
                    defaults={'full_name': initial_name, 'is_active': True}
                )

                if created:
                    patient.set_unusable_password()
                    try:
                        patient_role = UserRole.objects.get(slug='patient')
                        patient.role = patient_role
                    except UserRole.DoesNotExist:
                        logger.warning("Default 'patient' role not found during user creation.")
                    patient.save()

                # 2. Create or Reactivate Connection
                conn, conn_created = TreatmentConnection.objects.update_or_create(
                    doctor=doctor_user, 
                    patient=patient,
                    defaults={'status': TreatmentConnection.Status.ACTIVE}
                )

                if created:
                    message = f"حساب کاربری برای «{initial_name}» ایجاد و به لیست شما اضافه شد."
                elif conn_created:
                    message = f"بیمار «{patient.full_name}» به لیست شما اضافه شد."
                else: # Connection already existed, just ensured it's active.
                    message = "این بیمار از قبل در لیست شما وجود داشت. وضعیت ارتباط فعال شد."
                
                return True, message, patient

        except Exception as e:
            logger.error(f"Error in invite_patient_by_phone for Dr {doctor_user.id} -> {phone}: {e}")
            return False, "خطای داخلی در سرور هنگام افزودن بیمار.", None