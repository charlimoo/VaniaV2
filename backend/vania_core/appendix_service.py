# backend/vania_core/appendix_service.py
import uuid
import logging
from users.services import user_context_manager
from users.models import UserContextEntry
from .schemas import ThoughtAppendix, CulturalResource

logger = logging.getLogger(__name__)

class AppendixService:
    """
    Manages the 'Thought Appendix' (پیوست اندیشه) - the collection of 
    cultural resources (Books, Movies, Poems) prescribed to the patient.
    """
    CONTEXT_KEY = "thought_appendix_library"

    @staticmethod
    def get_library(patient) -> ThoughtAppendix:
        """
        Retrieves the library Pydantic model for a patient.
        Creates a default empty library if one doesn't exist.
        """
        entry = user_context_manager.get_context(patient, AppendixService.CONTEXT_KEY)
        
        default_lib = ThoughtAppendix()

        if not entry:
            user_context_manager.set_singleton_context(
                user=patient,
                key=AppendixService.CONTEXT_KEY,
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
    def add_resource(patient, doctor, resource_data: dict):
        """
        Adds a new resource to the library.
        """
        library = AppendixService.get_library(patient)
        
        new_item = CulturalResource(
            id=str(uuid.uuid4()),
            **resource_data
        )
        # Insert at the top of the list
        library.resources.insert(0, new_item)
        
        # Persist
        entry = user_context_manager.get_context(patient, AppendixService.CONTEXT_KEY)
        if entry:
            entry.data = library.model_dump()
            entry.save()
            
        return new_item

    @staticmethod
    def update_resource_status(patient, resource_id: str, status: str) -> bool:
        """
        Updates the status of a resource (e.g. from 'SUGGESTED' to 'CONSUMED').
        Used when a patient finishes a book or movie.
        """
        library = AppendixService.get_library(patient)
        
        updated = False
        for res in library.resources:
            if res.id == resource_id:
                res.status = status
                updated = True
                break
        
        if updated:
            entry = user_context_manager.get_context(patient, AppendixService.CONTEXT_KEY)
            if entry:
                entry.data = library.model_dump()
                entry.save()
                return True
        
        return False