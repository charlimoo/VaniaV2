# backend/services/usage.py
import logging
from django.core.cache import cache
from django.utils import timezone
from agents.storage import get_storage, get_session_safe
from asgiref.sync import sync_to_async


logger = logging.getLogger(__name__)

class DemoUsageService:
    """
    Manages usage limits for Demo users (Session, Daily, Total limits).
    Uses Django's cache backend (e.g., Redis) for performance.
    """
    
    @staticmethod
    def get_daily_cache_key(user_id: int, agent_slug: str) -> str:
        today = timezone.now().strftime("%Y-%m-%d")
        return f"demo_usage:daily:{user_id}:{agent_slug}:{today}"

    @staticmethod
    def get_total_cache_key(user_id: int, agent_slug: str) -> str:
        return f"demo_usage:total:{user_id}:{agent_slug}"

    async def check_limits(self, user, service, session_id: str) -> tuple[bool, str]:
        """
        Checks if the user can send a message based on the agent's demo_config.
        Returns (True, "Allowed") if allowed, or (False, "Reason for block") if not.
        """
        config = service.demo_config or {}
        
        # 1. Check Access Mode (Immediate Block)
        access_mode = config.get("access_mode", "ALLOWED")
        if access_mode == "BLOCKED":
            return False, "دسترسی به نسخه دمو برای این دستیار فعال نمیباشد."

        # 2. Check Message Limits
        limit_scope = config.get("message_limit_scope", "NONE")
        if limit_scope == "NONE":
            return True, "Allowed"

        limit_count = config.get("message_limit_count", 5)

        # A. Session Scope: Count messages directly from the session object
        if limit_scope == "SESSION":
            storage = get_storage()
            session = await sync_to_async(get_session_safe)(storage, session_id, str(user.id))
            if session:
                msgs = []
                if hasattr(session, 'memory') and session.memory and hasattr(session.memory, 'messages'):
                    msgs = session.memory.messages
                elif hasattr(session, 'messages'):
                    msgs = session.messages
                
                user_msg_count = sum(1 for m in msgs if (getattr(m, 'role', None) or m.get('role')) == 'user')
                
                if user_msg_count >= limit_count:
                    return False, f"ظرفیت استفاده از دمو در این گفتگو به پایان رسیده است ({limit_count} پیام)."

        # B. Daily Scope: Check value from cache
        elif limit_scope == "DAILY":
            key = self.get_daily_cache_key(user.id, service.slug)
            current_count = cache.get(key, 0)
            if current_count >= limit_count:
                return False, f"ظرفیت استفاده روزانه شما از نسخه دمو به پایان رسیده است ({limit_count} پیام)."

        # C. Total Scope: Check value from cache
        elif limit_scope == "TOTAL":
            key = self.get_total_cache_key(user.id, service.slug)
            current_count = cache.get(key, 0)
            if current_count >= limit_count:
                return False, "ظرفیت کلی شما برای استفاده از نسخه دمو به پایان رسیده است."

        return True, "Allowed"

    async def increment_usage(self, user, service):
        """
        Increments the usage counter in the cache after a successful demo run.
        This is a fire-and-forget operation.
        """
        config = service.demo_config or {}
        limit_scope = config.get("message_limit_scope", "SESSION")
        
        if limit_scope == "DAILY":
            key = self.get_daily_cache_key(user.id, service.slug)
            # Increment or set to 1, with a 24h timeout
            try:
                cache.incr(key)
            except ValueError:
                cache.set(key, 1, timeout=86400)
        
        elif limit_scope == "TOTAL":
            key = self.get_total_cache_key(user.id, service.slug)
            # Increment or set to 1, with no timeout
            try:
                cache.incr(key)
            except ValueError:
                cache.set(key, 1, timeout=None)

# Singleton instance for easy import
demo_usage_service = DemoUsageService()