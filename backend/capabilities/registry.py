# backend/capabilities/registry.py
import importlib
import pkgutil
import logging
from typing import Dict, List, Any, Tuple, Optional, Type

# Explicit import to avoid circular dependency issues during evaluation
from .base import BaseCapability, BaseCanvas, BaseFormHandler

logger = logging.getLogger(__name__)

class CapabilityRegistry:
    # Storage maps using actual class types for hints
    _canvases: Dict[str, Type[BaseCanvas]] = {}
    _form_handlers: Dict[str, Type[BaseFormHandler]] = {}
    _domain_capabilities: Dict[str, List[BaseCapability]] = {}

    @classmethod
    def register_canvas(cls, canvas_class: Type[BaseCanvas]):
        if hasattr(canvas_class, 'component_key') and canvas_class.component_key:
            cls._canvases[canvas_class.component_key] = canvas_class
        return canvas_class

    @classmethod
    def register_form_handler(cls, handler_class: Type[BaseFormHandler]):
        cls._form_handlers[handler_class.get_id()] = handler_class
        return handler_class

    @classmethod
    def register_capability(cls, domain: str):
        def decorator(cap_class: Type[BaseCapability]):
            if domain not in cls._domain_capabilities:
                cls._domain_capabilities[domain] = []
            cls._domain_capabilities[domain].append(cap_class())
            return cap_class
        return decorator

    # Compatibility alias
    register_tool = register_capability

    @classmethod
    def autodiscover(cls):
        """Walks the capabilities package to trigger @register decorators."""
        import capabilities
        path = capabilities.__path__
        prefix = capabilities.__name__ + "."

        for _, name, ispkg in pkgutil.walk_packages(path, prefix):
            try:
                importlib.import_module(name)
            except Exception as e:
                logger.error(f"❌ [Registry] Discovery failed in {name}: {e}")

    @classmethod
    def sync_to_db(cls):
        """Syncs code-defined canvases to the Django Database."""
        try:
            from services.models_canvas import CanvasType
            for key, canvas_cls in cls._canvases.items():
                CanvasType.objects.update_or_create(
                    component_key=key,
                    defaults={
                        "name": getattr(canvas_cls, 'name', key),
                        "slug": getattr(canvas_cls, 'slug', key.lower()),
                        "description": getattr(canvas_cls, 'description', ""),
                        "default_state": canvas_cls.get_default_state(),
                        "schema_definition": canvas_cls.get_schema()
                    }
                )
        except Exception as e:
            logger.error(f"⚠️ [Registry] DB Sync failed: {e}")

    @classmethod
    def get_tools_for_domains(cls, domains: List[str], user: Any, session_id: str) -> List[Any]:
        tools = []
        for domain in domains:
            caps = cls._domain_capabilities.get(domain, [])
            for cap in caps:
                try:
                    tools.extend(cap.get_tools(user, session_id))
                except Exception as e:
                    logger.error(f"Error getting tools for {domain}: {e}")
        return tools

    @classmethod
    def get_prompt_additions_for_domains(cls, domains: List[str], user: Any) -> str:
        instructions = []
        for domain in domains:
            caps = cls._domain_capabilities.get(domain, [])
            for cap in caps:
                try:
                    text = cap.get_system_prompt_additions(user)
                    if text: instructions.append(text)
                except Exception as e:
                    logger.error(f"Error getting prompts for {domain}: {e}")
        return "\n\n".join(instructions)

    @classmethod
    def get_canvases_for_domains(cls, domains: List[str]) -> List[str]:
        keys = set()
        for domain in domains:
            caps = cls._domain_capabilities.get(domain, [])
            for cap in caps:
                try:
                    keys.update(cap.get_default_canvases())
                except Exception as e:
                    logger.error(f"Error getting canvases for {domain}: {e}")
        return list(keys)

    # --- [NEW] Context Aggregation ---

    @classmethod
    def get_context_prompt_for_domains(cls, domains: List[str], user: Any, resource_id: str) -> str:
        """
        Aggregates context prompts from all active capabilities for a specific resource.
        Called by the Agent Factory when a resource context (X-Target-Resource-ID) is active.
        """
        prompts = []
        for domain in domains:
            caps = cls._domain_capabilities.get(domain, [])
            for cap in caps:
                try:
                    text = cap.get_context_prompt(user, resource_id)
                    if text:
                        prompts.append(text)
                except Exception as e:
                    logger.error(f"❌ [Registry] Context hook failed for {domain}: {e}")
        
        return "\n\n".join(prompts)

    @classmethod
    def get_initial_state_for_domains(
        cls, 
        domains: List[str], 
        user: Any, 
        session_id: str, 
        resource_id: str,
        canvas_key: str
    ) -> Optional[Dict[str, Any]]:
        """
        Finds the first capability that provides an initial state for the given resource and canvas key.
        Useful for pre-loading a specific dashboard (e.g. Patient Manager) immediately.
        """
        for domain in domains:
            caps = cls._domain_capabilities.get(domain, [])
            for cap in caps:
                try:
                    # Pass the key so the capability determines IF it owns this canvas
                    state = cap.get_initial_canvas_state(user, session_id, resource_id, canvas_key)
                    if state:
                        # Return the first match (Priority wins)
                        return state
                except Exception as e:
                    logger.error(f"❌ [Registry] Initial state hook failed for {domain} on {canvas_key}: {e}")
        return None

    @classmethod
    def get_handler(cls, handler_id: str) -> Optional[Type[BaseFormHandler]]:
        return cls._form_handlers.get(handler_id)

    @classmethod
    def get_handler_choices(cls) -> List[Tuple[str, str]]:
        choices = [(k, getattr(v, 'label', k)) for k, v in cls._form_handlers.items()]
        choices.sort(key=lambda x: x[1])
        return choices

# Registry Shortcuts
register_capability = CapabilityRegistry.register_capability
register_tool = CapabilityRegistry.register_capability
register_canvas = CapabilityRegistry.register_canvas
register_form_handler = CapabilityRegistry.register_form_handler