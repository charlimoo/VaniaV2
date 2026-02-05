# backend/vania_core/apps.py
from django.apps import AppConfig

class VaniaCoreConfig(AppConfig):
    """
    Django Application Configuration for Vania.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'vania_core'
    verbose_name = "Vania Clinical Core"

    def ready(self):
        """
        Import signals to register event handlers (e.g. Auto-linking invites,
        Approving Doctor Requests).
        """
        import vania_core.signals