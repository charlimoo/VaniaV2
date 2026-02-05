# backend/services/events.py
from dataclasses import dataclass, field
from typing import Dict, Any
from agno.run.agent import CustomEvent

# FormRenderEvent was removed in Phase 1.

@dataclass
class CartUpdateEvent(CustomEvent):
    """
    Event emitted when the Agent modifies the shopping cart (Add/Remove items).
    The frontend should listen to this to refresh the Cart Icon/Badge or Slide-over.
    
    Attributes:
        name (str): 'CART_UPDATE'
        value (Dict): 
            - count: Total items count in cart (int)
            - last_item: Name of the item just added/modified (str, optional)
            - total_value: Current cart total value (float, optional)
    """
    name: str = "CART_UPDATE"
    value: Dict[str, Any] = field(default_factory=dict)