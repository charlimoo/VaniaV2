# backend/services/apps.py
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)

class ServicesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'services'
    verbose_name = "AI Services & RAG"

    def ready(self):
        # 1. Register Signals (e.g. for RAG processing)
        import services.signals
        
        # 2. Capability Registry Autodiscovery
        # This scans the 'capabilities' directory and imports modules (vania_doctor, etc.)
        # so they can register their Tools, Canvases, and Form Handlers via decorators.
        # We do this here to ensure registries are populated before Views/Agents need them.
        try:
            from capabilities.registry import CapabilityRegistry
            CapabilityRegistry.autodiscover()
            logger.info("✅ [Services] Capability Registry auto-discovery complete.")
        except Exception as e:
            # We catch exceptions to prevent crashing the entire Django boot process
            # if a single plugin has a syntax error, but we log it loudly.
            logger.error(f"❌ [Services] Capability Registry discovery failed: {e}", exc_info=True)