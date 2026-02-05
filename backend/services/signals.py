# backend/services/signals.py
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import AgentService
from .access_service import AccessControlService

logger = logging.getLogger(__name__)

@receiver([post_save], sender=AgentService)
def invalidate_global_agent_warning(sender, instance, **kwargs):
    """
    If an Admin modifies an Agent (e.g. disables it), we log a warning.
    We do NOT wipe all keys because we cannot efficiently find every user key.
    The TTL (5 mins) handles eventual consistency for global changes.
    """
    if not instance.is_active:
        logger.warning(f"🚨 Agent {instance.slug} disabled/modified. User caches expire in {AccessControlService.CACHE_TTL}s.")