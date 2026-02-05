# backend/definitions/base.py
from dataclasses import dataclass, field
from decimal import Decimal
from typing import List, Optional, Dict, Any
from enum import Enum

class DemoAccessMode(str, Enum):
    """Defines if a demo user can access the chat at all."""
    ALLOWED = "ALLOWED"
    BLOCKED = "BLOCKED"

class DemoLimitScope(str, Enum):
    """Defines how the message limit is counted."""
    SESSION = "SESSION"  # Per chat thread
    DAILY = "DAILY"      # Per 24-hour period
    TOTAL = "TOTAL"      # Lifetime usage for the agent
    NONE = "NONE"        # No message limit

class DemoCanvasMode(str, Enum):
    """Defines how the UI Canvas behaves in demo mode."""
    HIDDEN = "HIDDEN"    # Panel is not rendered
    LOCKED = "LOCKED"    # Panel is visible but shows a lock overlay
    OPEN = "OPEN"        # Panel is fully functional

@dataclass
class DemoConfigDef:
    """
    Configuration for how the Agent behaves for users without a plan.
    This object is serialized into a JSONField on the AgentService model.
    """
    access_mode: DemoAccessMode = DemoAccessMode.ALLOWED
    model_override: Optional[str] = None
    message_limit_scope: DemoLimitScope = DemoLimitScope.SESSION
    message_limit_count: int = 5
    canvas_mode: DemoCanvasMode = DemoCanvasMode.LOCKED
    canvas_placeholder_text: str = "This interactive feature is available in the Pro version. Please upgrade your plan for full access."

    def to_dict(self) -> Dict[str, Any]:
        """Serializes the dataclass, converting enums to their string values for JSON."""
        return {
            "access_mode": self.access_mode.value,
            "model_override": self.model_override,
            "message_limit_scope": self.message_limit_scope.value,
            "message_limit_count": self.message_limit_count,
            "canvas_mode": self.canvas_mode.value,
            "canvas_placeholder_text": self.canvas_placeholder_text,
        }
        
@dataclass
class PlanDef:
    """
    Defines a Subscription Tier (e.g. 'Pro Plan').
    """
    slug: str          # Internal unique ID (e.g. 'pro-monthly')
    name: str          # Display name (e.g. 'اشتراک حرفه‌ای')
    description: str   # Benefits description
    price: int         # Price in Toman
    duration_days: int # Validity period (e.g. 30)
    monthly_credits: int # Credits granted upon activation
    # List of Agent slugs that this plan unlocks
    included_agent_slugs: List[str] = field(default_factory=list) 
    is_active: bool = True

@dataclass
class ProductDef:
    """
    Represents a purchasable item in the store.
    Can be a Credit Top-up OR a Plan Activation.
    """
    name: str
    price: int # Price in Toman
    description: str = ""
    credits: int = 0
    # If set, buying this product activates the plan with this slug
    linked_plan_slug: Optional[str] = None 
    is_active: bool = True

@dataclass
class DiscountDef:
    """
    Defines a discount code configuration.
    """
    code: str
    percent: int
    is_active: bool = True
    max_amount: Optional[int] = None
    max_fund: Optional[int] = None
    expiry_date: Optional[str] = None # ISO Format: "YYYY-MM-DDTHH:MM:SS"

@dataclass
class SuggestionDef:
    title: str
    prompt: str
    subtitle: str = ""

@dataclass
class AgentDef:
    """
    Defines an AI Agent configuration.
    Pricing/Access is now determined by whether the agent is 'Free' 
    or included in a 'Plan'.
    """
    slug: str
    name: str
    model_id: str
    description: str
    system_prompt: str
    
    # --- Marketplace & Access ---
    is_free: bool = True
    demo_config: DemoConfigDef = field(default_factory=DemoConfigDef)
    # Note: Paid agents are unlocked via Plans defined in billing.py
    
    # --- Logic & Capabilities ---
    capabilities: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    user_guide: str = ""
    is_public: bool = True
    is_active: bool = True
    
    cost_multiplier: Decimal = Decimal("1.0")
    enable_reasoning: bool = False
    reasoning_effort: str = "low"
    
    # Tools & Resources
    static_tools: List[str] = field(default_factory=list)
    suggestions: List[SuggestionDef] = field(default_factory=list)
    default_open_canvases: List[str] = field(default_factory=list)

    # [NEW] Explicit UI Configuration
    # Example: {"has_canvas": True, "default_width": 70}
    extra_config: Dict[str, Any] = field(default_factory=dict)