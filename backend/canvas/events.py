# backend/canvas/events.py
from dataclasses import dataclass, field
from typing import Dict, Any
from agno.run.agent import CustomEvent

@dataclass
class CanvasUpdateEvent(CustomEvent):
    """
    A custom event definition for AG-UI Canvas updates.
    
    When this object is yielded from an Agno tool using 'yield', the Agno runtime 
    automatically propagates it to the stream. The AG-UI stream generator then 
    wraps it in the standard protocol format.
    
    Attributes:
        name (str): The event name identifier used by the frontend parser (default: 'CANVAS_UPDATE').
        value (Dict): The payload containing canvas_id, delta, and metadata.
    """
    name: str = "CANVAS_UPDATE"
    value: Dict[str, Any] = field(default_factory=dict)