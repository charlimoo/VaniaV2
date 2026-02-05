# backend/capabilities/base.py
from typing import List, Any, Dict, Optional

class BaseCapability:
    """
    Base definition for a Domain Capability.
    Plugins (like Vania) inherit from this to hook into the Agent lifecycle,
    inject context, and provide tools.
    """
    
    def get_tools(self, user: Any, session_id: str) -> List[Any]:
        """
        Returns a list of Agno tools (functions decorated with @tool) 
        that this capability provides to the agent.
        """
        return []

    def get_system_prompt_additions(self, user: Any) -> str:
        """
        Static instructions added to the system prompt based on the user identity.
        Example: 'You are a helpful trading assistant.'
        """
        return ""

    def get_default_canvases(self) -> List[str]:
        """
        Returns a list of Canvas Component Keys (e.g. 'VANIA_PATIENT_MANAGER')
        that should be initialized when this capability is active.
        """
        return []

    def on_agent_start(self, user: Any, session_id: str):
        """
        Lifecycle hook called when the agent is initialized.
        """
        pass

    # --- [NEW] Context & State Hooks for Scoped Execution ---

    def get_context_prompt(self, user: Any, resource_id: str) -> str:
        """
        Dynamic Context Injection.
        Called when a 'X-Target-Resource-ID' header is present in the request.
        
        Args:
            user: The authenticated CustomUser.
            resource_id: The ID string from the header (e.g. Patient ID).
            
        Returns:
            str: Specific details about the resource to inject into the System Prompt.
                 (e.g. 'Active Patient: Ali, Age 30...')
        """
        return ""

    def get_initial_canvas_state(
        self, 
        user: Any, 
        session_id: str, 
        resource_id: str,
        canvas_key: str
    ) -> Optional[Dict[str, Any]]:
        """
        Auto-Hydration Hook.
        Called during Agent Factory initialization to pre-load UI state.
        
        Args:
            user: The authenticated CustomUser.
            session_id: The current chat session ID.
            resource_id: The target resource ID (if context is locked).
            canvas_key: The specific component key being hydrated (e.g. 'VANIA_PATIENT_MANAGER').
            
        Returns:
            Optional[Dict]: A JSON state object to populate the DB immediately.
                            Return None to use the CanvasType default state.
        """
        return None


class BaseCanvas:
    """
    Base definition for a UI Canvas (Side Panel).
    """
    component_key: str = "UNKNOWN"
    name: str = "Untitled Canvas"
    slug: str = "untitled-v1"
    description: str = ""
    
    @classmethod
    def get_default_state(cls) -> Dict[str, Any]:
        return {}

    @classmethod
    def get_schema(cls) -> Dict[str, Any]:
        return {}


class BaseFormHandler:
    """
    Base logic for processing a dynamic form submission from the frontend.
    """
    label: str = "Untitled Logic" 

    @classmethod
    def get_id(cls) -> str:
        return cls.__name__

    def process(
        self, 
        user: Any, 
        data: Dict[str, Any], 
        session_id: str, 
        resource_id: str = None
    ) -> Dict[str, Any]:
        """
        Executes the business logic for the form.
        """
        raise NotImplementedError("Form logic must implement process()")