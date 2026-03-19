import logging
import uuid
from typing import Optional

from users.models import UserContextEntry
from users.services import user_context_manager

from .case_service import build_case_scoped_key
from .context_scope import build_scoped_key, migrate_doctor_scoped_to_case_once, migrate_legacy_to_scoped_once
from .schemas import MedicationEntry, MedicationPlan

logger = logging.getLogger(__name__)


class MedicationService:
    """
    Manages case-scoped medication entries shared between the expert and visitor.
    """

    CONTEXT_KEY = "case_medications"

    @staticmethod
    def get_plan(patient, doctor_id: Optional[int] = None, case_id: Optional[str] = None) -> MedicationPlan:
        if doctor_id and case_id:
            entry = migrate_doctor_scoped_to_case_once(
                patient=patient,
                doctor_id=doctor_id,
                case_id=case_id,
                base_key=MedicationService.CONTEXT_KEY,
                default_factory=lambda: MedicationPlan().model_dump(),
            )
        elif doctor_id:
            entry = migrate_legacy_to_scoped_once(
                patient=patient,
                doctor_id=doctor_id,
                base_key=MedicationService.CONTEXT_KEY,
                default_factory=lambda: MedicationPlan().model_dump(),
            )
        else:
            entry = user_context_manager.get_context(patient, MedicationService.CONTEXT_KEY)

        default_plan = MedicationPlan()
        if not entry:
            user_context_manager.set_singleton_context(
                user=patient,
                key=build_case_scoped_key(MedicationService.CONTEXT_KEY, doctor_id, case_id) if doctor_id and case_id else build_scoped_key(MedicationService.CONTEXT_KEY, doctor_id) if doctor_id else MedicationService.CONTEXT_KEY,
                data=default_plan.model_dump(),
                source=UserContextEntry.SourceType.SYSTEM,
            )
            return default_plan

        try:
            return MedicationPlan(**entry.data)
        except Exception as exc:
            logger.error("Schema mismatch in MedicationPlan for user %s: %s", patient.id, exc)
            return default_plan

    @staticmethod
    def save_plan(patient, medications: list[dict], creator=None, doctor_id: Optional[int] = None, case_id: Optional[str] = None) -> MedicationPlan:
        normalized = []
        for item in medications or []:
            payload = dict(item)
            payload.setdefault("id", str(uuid.uuid4()))
            payload.setdefault("case_id", case_id)
            normalized.append(MedicationEntry(**payload))

        plan = MedicationPlan(medications=normalized)
        key = build_case_scoped_key(MedicationService.CONTEXT_KEY, doctor_id, case_id) if doctor_id and case_id else build_scoped_key(MedicationService.CONTEXT_KEY, doctor_id) if doctor_id else MedicationService.CONTEXT_KEY
        user_context_manager.set_singleton_context(
            user=patient,
            key=key,
            data=plan.model_dump(),
            source=UserContextEntry.SourceType.AGENT if creator else UserContextEntry.SourceType.USER,
            creator=creator,
        )
        return plan

    @staticmethod
    def add_medication(patient, doctor, medication_data: dict, doctor_id: Optional[int] = None, case_id: Optional[str] = None) -> MedicationEntry:
        plan = MedicationService.get_plan(patient, doctor_id=doctor_id, case_id=case_id)
        new_item = MedicationEntry(
            id=str(uuid.uuid4()),
            doctor_id=getattr(doctor, "id", None),
            doctor_name=getattr(doctor, "full_name", None) or getattr(doctor, "phone_number", None),
            case_id=case_id,
            **medication_data,
        )
        plan.medications.insert(0, new_item)
        MedicationService.save_plan(patient, [item.model_dump() for item in plan.medications], creator=doctor, doctor_id=doctor_id, case_id=case_id)
        return new_item

    @staticmethod
    def update_medication(patient, medication_id: str, updates: dict, creator=None, doctor_id: Optional[int] = None, case_id: Optional[str] = None) -> Optional[MedicationEntry]:
        plan = MedicationService.get_plan(patient, doctor_id=doctor_id, case_id=case_id)
        updated_item = None
        next_items = []
        for item in plan.medications:
            if item.id == medication_id:
                updated_item = MedicationEntry(**{**item.model_dump(), **updates})
                next_items.append(updated_item.model_dump())
            else:
                next_items.append(item.model_dump())
        if not updated_item:
            return None
        MedicationService.save_plan(patient, next_items, creator=creator, doctor_id=doctor_id, case_id=case_id)
        return updated_item

    @staticmethod
    def delete_medication(patient, medication_id: str, creator=None, doctor_id: Optional[int] = None, case_id: Optional[str] = None) -> bool:
        plan = MedicationService.get_plan(patient, doctor_id=doctor_id, case_id=case_id)
        next_items = [item.model_dump() for item in plan.medications if item.id != medication_id]
        if len(next_items) == len(plan.medications):
            return False
        MedicationService.save_plan(patient, next_items, creator=creator, doctor_id=doctor_id, case_id=case_id)
        return True
