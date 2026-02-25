# backend/services/access_service.py
import logging
from datetime import timedelta
from django.core.cache import cache
from django.utils import timezone
from users.models import CustomUser
from users.eligibility import is_user_eligible_for_agent
from .models import AgentService

logger = logging.getLogger(__name__)

class AccessControlService:
    """
    Determines if a User can access an Agent based on their Wallet's Active Plan.
    """
    CACHE_TTL = 300  # 5 Minutes
    # Grace period for plan expiry (allows finishing active conversations)
    GRACE_PERIOD = timedelta(hours=1) 

    @staticmethod
    def get_cache_key(user_id: int, agent_slug: str) -> str:
        return f"access:user_{user_id}:agent_{agent_slug}"

    def check_permission(self, user: CustomUser, agent_slug: str) -> tuple[bool, str]:
        # 1. Fast Path: Cache Hit
        cache_key = self.get_cache_key(user.id, agent_slug)
        cached_result = cache.get(cache_key)
        
        if cached_result is not None:
            return cached_result

        # 2. Slow Path: DB Lookup
        try:
            agent = AgentService.objects.get(slug=agent_slug)
        except AgentService.DoesNotExist:
            return False, "Agent not found"

        # 3. Resolve Logic
        result = self._resolve_permission(user, agent)
        
        # 4. Cache Result
        cache.set(cache_key, result, self.CACHE_TTL)
        
        return result

    def _resolve_permission(self, user: CustomUser, agent: AgentService) -> tuple[bool, str]:
        """
        Internal logic resolver (Database-bound).
        """
        # Rule 1: Maintenance Mode
        if not agent.is_active:
            return False, "Service is currently disabled."

        # Rule 1.5: Role/Profession Eligibility
        if not is_user_eligible_for_agent(user, agent):
            return False, "You are not eligible for this agent."

        # Rule 2: Free Agents
        # Free agents are accessible to everyone, regardless of plan status.
        if agent.is_free:
            return True, "Free access"

        # Rule 3: Wallet & Plan Check
        try:
            wallet = user.wallet
        except Exception:
            return False, "No wallet found"

        if not wallet.active_plan:
            return False, "Plan required"

        # Rule 4: Plan Expiry
        if not wallet.plan_expires_at:
             return False, "Invalid plan state"
             
        if wallet.plan_expires_at + self.GRACE_PERIOD < timezone.now():
            return False, "Plan expired"

        # Rule 5: Bundle Inclusion
        # Check if the agent is included in the user's active plan.
        # We query the M2M relation: agent.plans -> does it contain wallet.active_plan?
        if agent.plans.filter(id=wallet.active_plan.id).exists():
            return True, "Included in plan"

        return False, "Upgrade required"

# Singleton Instance
access_service = AccessControlService()
