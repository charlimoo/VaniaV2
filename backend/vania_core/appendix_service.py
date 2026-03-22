# backend/vania_core/appendix_service.py
import uuid
import logging
from users.services import user_context_manager
from users.models import UserContextEntry
from .schemas import ThoughtAppendix, CulturalResource, ResourceType
from .context_scope import migrate_legacy_to_scoped_once, migrate_doctor_scoped_to_case_once, build_scoped_key
from .case_service import build_case_scoped_key

logger = logging.getLogger(__name__)

RESOURCE_TYPE_ALIASES = {
    "BOOK": ResourceType.BOOK.value,
    "BOOKS": ResourceType.BOOK.value,
    "کتاب": ResourceType.BOOK.value,
    "MOVIE": ResourceType.MOVIE.value,
    "FILM": ResourceType.MOVIE.value,
    "MOVIES": ResourceType.MOVIE.value,
    "FILMS": ResourceType.MOVIE.value,
    "فیلم": ResourceType.MOVIE.value,
    "POEM": ResourceType.POEM.value,
    "POEMS": ResourceType.POEM.value,
    "POETRY": ResourceType.POEM.value,
    "شعر": ResourceType.POEM.value,
}


def normalize_resource_type(value: str | None) -> str:
    normalized = (value or "").strip()
    if not normalized:
        return ResourceType.BOOK.value
    alias_key = normalized.upper()
    if alias_key in ResourceType._value2member_map_:
        return alias_key
    return RESOURCE_TYPE_ALIASES.get(alias_key, ResourceType.BOOK.value)

class AppendixService:
    """
    Manages the 'Thought Appendix' (پیوست اندیشه) - the collection of 
    cultural resources (Books, Movies, Poems) prescribed to the patient.
    """
    CONTEXT_KEY = "thought_appendix_library"

    @staticmethod
    def get_library(patient, doctor_id=None, case_id=None) -> ThoughtAppendix:
        """
        Retrieves the library Pydantic model for a patient.
        Creates a default empty library if one doesn't exist.
        """
        if doctor_id and case_id:
            entry = migrate_doctor_scoped_to_case_once(
                patient=patient,
                doctor_id=doctor_id,
                case_id=case_id,
                base_key=AppendixService.CONTEXT_KEY,
                default_factory=lambda: ThoughtAppendix().model_dump(),
            )
        elif doctor_id:
            entry = migrate_legacy_to_scoped_once(
                patient=patient,
                doctor_id=doctor_id,
                base_key=AppendixService.CONTEXT_KEY,
                default_factory=lambda: ThoughtAppendix().model_dump(),
            )
        else:
            entry = user_context_manager.get_context(patient, AppendixService.CONTEXT_KEY)
        
        default_lib = ThoughtAppendix()

        if not entry:
            user_context_manager.set_singleton_context(
                user=patient,
                key=build_case_scoped_key(AppendixService.CONTEXT_KEY, doctor_id, case_id) if doctor_id and case_id else build_scoped_key(AppendixService.CONTEXT_KEY, doctor_id) if doctor_id else AppendixService.CONTEXT_KEY,
                data=default_lib.model_dump(),
                source=UserContextEntry.SourceType.SYSTEM
            )
            return default_lib
        
        try:
            return ThoughtAppendix(**entry.data)
        except Exception as e:
            logger.error(f"Schema mismatch in Appendix for user {patient.id}: {e}")
            return default_lib

    @staticmethod
    def add_resource(patient, doctor, resource_data: dict, doctor_id=None, case_id=None):
        """
        Adds a new resource to the library.
        """
        library = AppendixService.get_library(patient, doctor_id=doctor_id, case_id=case_id)
        normalized_resource = {
            **resource_data,
            "type": normalize_resource_type(resource_data.get("type")),
        }
        
        new_item = CulturalResource(
            id=str(uuid.uuid4()),
            **normalized_resource
        )
        # Insert at the top of the list
        library.resources.insert(0, new_item)
        
        # Persist
        key = build_case_scoped_key(AppendixService.CONTEXT_KEY, doctor_id, case_id) if doctor_id and case_id else build_scoped_key(AppendixService.CONTEXT_KEY, doctor_id) if doctor_id else AppendixService.CONTEXT_KEY
        entry = user_context_manager.get_context(patient, key)
        if entry:
            entry.data = library.model_dump()
            entry.save()
            
        return new_item

    @staticmethod
    def update_resource_status(patient, resource_id: str, status: str, doctor_id=None, case_id=None) -> bool:
        """
        Updates the status of a resource (e.g. from 'SUGGESTED' to 'CONSUMED').
        Used when a patient finishes a book or movie.
        """
        library = AppendixService.get_library(patient, doctor_id=doctor_id, case_id=case_id)
        
        updated = False
        for res in library.resources:
            if res.id == resource_id:
                res.status = status
                updated = True
                break
        
        if updated:
            key = build_case_scoped_key(AppendixService.CONTEXT_KEY, doctor_id, case_id) if doctor_id and case_id else build_scoped_key(AppendixService.CONTEXT_KEY, doctor_id) if doctor_id else AppendixService.CONTEXT_KEY
            entry = user_context_manager.get_context(patient, key)
            if entry:
                entry.data = library.model_dump()
                entry.save()
                return True
        
        return False
