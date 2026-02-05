import logging
from users.services import user_context_manager
from users.models import UserContextEntry
from .schemas import TherapyRoadmap, TherapyPhase, RoadmapSession

logger = logging.getLogger(__name__)

class RoadmapService:
    CONTEXT_KEY = "therapy_roadmap"

    @staticmethod
    def get_or_create_roadmap(patient) -> TherapyRoadmap:
        """
        Retrieves the roadmap from the DB and returns it as a Pydantic model.
        """
        entry = user_context_manager.get_context(patient, RoadmapService.CONTEXT_KEY)
        
        # Default empty state
        default_roadmap = TherapyRoadmap()

        if not entry:
            # Create new in DB
            user_context_manager.set_singleton_context(
                user=patient,
                key=RoadmapService.CONTEXT_KEY,
                data=default_roadmap.model_dump(),
                source=UserContextEntry.SourceType.SYSTEM
            )
            return default_roadmap
        
        try:
            # Parse existing JSON into Pydantic
            return TherapyRoadmap(**entry.data)
        except Exception as e:
            logger.error(f"Schema mismatch in Roadmap for user {patient.id}: {e}")
            return default_roadmap

    @staticmethod
    def save_roadmap(patient, roadmap_model: TherapyRoadmap):
        """
        Saves the Pydantic model back to the DB.
        """
        entry = user_context_manager.get_context(patient, RoadmapService.CONTEXT_KEY)
        if entry:
            entry.data = roadmap_model.model_dump()
            entry.save()

    @staticmethod
    def update_phase(patient, phase: TherapyPhase):
        roadmap = RoadmapService.get_or_create_roadmap(patient)
        roadmap.current_phase = phase
        RoadmapService.save_roadmap(patient, roadmap)

    @staticmethod
    def add_session(patient, title: str, instructions: str):
        roadmap = RoadmapService.get_or_create_roadmap(patient)
        
        next_num = len(roadmap.sessions) + 1
        new_session = RoadmapSession(
            session_number=next_num,
            title=title,
            doctor_instructions=instructions
        )
        roadmap.sessions.append(new_session)
        
        RoadmapService.save_roadmap(patient, roadmap)
        
        return new_session # [FIX] Return the object!

    @staticmethod
    def complete_session(patient, session_number: int, doc_id: str):
        roadmap = RoadmapService.get_or_create_roadmap(patient)
        
        for sess in roadmap.sessions:
            if sess.session_number == session_number:
                sess.status = "COMPLETED"
                sess.doc_id = doc_id
        
        # Reset active session if it was this one
        if roadmap.active_session_number == session_number:
            roadmap.active_session_number = None
            
        RoadmapService.save_roadmap(patient, roadmap)