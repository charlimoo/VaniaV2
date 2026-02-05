# backend/vania_core/task_service.py
import uuid
import logging
from django.utils import timezone
from django.db import transaction
from users.services import user_context_manager
from users.models import UserContextEntry
from .models import Notification, TreatmentConnection

logger = logging.getLogger(__name__)

class TaskService:
    """
    Manages the 'Rescue Net' (Tour-e Nejat) tasks.
    Handles creation, completion, and doctor notifications.
    """
    CONTEXT_KEY = "patient_tasks"

    @staticmethod
    def _get_or_create_task_list_entry(patient) -> UserContextEntry:
        entry = UserContextEntry.objects.filter(
            user=patient,
            definition__key=TaskService.CONTEXT_KEY,
            is_active=True
        ).first()

        if entry:
            return entry
        
        return user_context_manager.set_singleton_context(
            user=patient,
            key=TaskService.CONTEXT_KEY,
            data={"tasks": []},
            source=UserContextEntry.SourceType.SYSTEM
        )

    @staticmethod
    def assign_task(patient, doctor, text: str, due_date: str = None, dimension: str = "PERSONAL") -> dict:
        """
        Assigns a new task to the patient.
        Triggers a notification for the patient.
        """
        with transaction.atomic():
            entry = UserContextEntry.objects.select_for_update().get(
                pk=TaskService._get_or_create_task_list_entry(patient).pk
            )
            
            current_data = entry.data
            if not isinstance(current_data, dict) or "tasks" not in current_data:
                current_data = {"tasks": []}

            new_task = {
                "id": str(uuid.uuid4()),
                "text": text,
                "status": "PENDING",
                "dimension": dimension,
                "doctor_id": doctor.id,
                "doctor_name": doctor.full_name or f"Dr. {doctor.phone_number}",
                "created_at": timezone.now().isoformat(),
                "completed_at": None,
                "due_date": due_date
            }

            current_data["tasks"].insert(0, new_task)
            entry.data = current_data
            entry.save()

            # Create Notification for Patient
            try:
                Notification.objects.create(
                    recipient=patient,
                    sender=doctor,
                    type=Notification.Type.TASK_ASSIGNED,
                    title="تکلیف جدید ثبت شد",
                    message=f"تکلیف: {text}",
                    payload={"url": "/dashboard/tasks"}
                )
            except Exception:
                pass

            return new_task

    @staticmethod
    def update_task_status(patient, task_id: str, status: str, reflection: str = None) -> bool:
        """
        Updates the status of a task (e.g. PENDING -> DONE).
        If status is DONE, it sends a notification to the assigned doctor.
        """
        with transaction.atomic():
            entry = UserContextEntry.objects.select_for_update().get(
                pk=TaskService._get_or_create_task_list_entry(patient).pk
            )

            tasks = entry.data.get("tasks", [])
            updated = False
            target_task = None

            for task in tasks:
                if task.get("id") == task_id:
                    task["status"] = status
                    if reflection:
                        task["patient_reflection"] = reflection
                    if status == "DONE":
                        task["completed_at"] = timezone.now().isoformat()
                    
                    target_task = task
                    updated = True
                    break
            
            if updated:
                entry.data["tasks"] = tasks
                entry.save()

                # [NEW] Notify Doctor Logic
                if status == "DONE":
                    try:
                        # 1. Identify the doctor
                        doctor_id = target_task.get("doctor_id")
                        recipient = None
                        
                        if doctor_id:
                            from users.models import CustomUser
                            try:
                                recipient = CustomUser.objects.get(pk=doctor_id)
                            except CustomUser.DoesNotExist:
                                pass
                        
                        # Fallback: Use primary active connection if doctor_id is missing
                        if not recipient:
                            conn = TreatmentConnection.objects.filter(
                                patient=patient, status=TreatmentConnection.Status.ACTIVE
                            ).select_related('doctor').first()
                            if conn:
                                recipient = conn.doctor

                        # 2. Send Notification
                        if recipient:
                            msg = f"بیمار {patient.full_name} تکلیف «{target_task['text']}» را انجام داد."
                            if reflection:
                                msg += f"\nبازخورد: {reflection}"

                            Notification.objects.create(
                                recipient=recipient,
                                sender=patient,
                                type=Notification.Type.TASK_ASSIGNED, # Or custom 'PATIENT_ACTIVITY'
                                title="تکلیف انجام شد",
                                message=msg,
                                payload={"url": "/dashboard/patients"}
                            )
                    except Exception as e:
                        logger.error(f"Failed to send task completion notification: {e}")

                return True
            return False

    @staticmethod
    def edit_task(patient, task_id: str, text: str = None, due_date: str = None) -> bool:
        with transaction.atomic():
            entry = UserContextEntry.objects.select_for_update().get(
                pk=TaskService._get_or_create_task_list_entry(patient).pk
            )
            tasks = entry.data.get("tasks", [])
            updated = False
            for task in tasks:
                if task["id"] == task_id:
                    if text is not None: task["text"] = text
                    if due_date is not None: task["due_date"] = due_date
                    updated = True
                    break
            
            if updated:
                entry.data["tasks"] = tasks
                entry.save()
                return True
            return False

    @staticmethod
    def delete_task(patient, task_id: str) -> bool:
        with transaction.atomic():
            entry = UserContextEntry.objects.select_for_update().get(
                pk=TaskService._get_or_create_task_list_entry(patient).pk
            )
            
            original_count = len(entry.data.get("tasks", []))
            entry.data["tasks"] = [t for t in entry.data["tasks"] if t.get("id") != task_id]
            
            if len(entry.data["tasks"]) < original_count:
                entry.save()
                return True
            return False

    @staticmethod
    def get_patient_tasks(patient) -> list:
        entry = TaskService._get_or_create_task_list_entry(patient)
        return entry.data.get("tasks", [])