# backend/capabilities/signals.py
from django.db.models.signals import post_migrate
from django.dispatch import receiver
from .registry import CapabilityRegistry

@receiver(post_migrate)
def sync_capabilities_callback(sender, **kwargs):
    """
    Triggers DB sync after the 'services' app is fully migrated.
    """
    if sender.name == 'services':
        try:
            CapabilityRegistry.sync_to_db()
        except Exception as e:
            print(f"⚠️ [Registry] Sync failed: {e}")