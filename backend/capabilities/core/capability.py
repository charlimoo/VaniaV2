# backend/capabilities/core/capability.py
from typing import List, Any
from agno.tools.calculator import CalculatorTools

# Import the actual tool functions defined in core/tools.py
from .tools import (
    generate_chart, 
    show_data_table, 
    show_media_card, 
    show_option_list,
)

from capabilities.base import BaseCapability
from capabilities.registry import register_capability

@register_capability("core")
class CoreCapability(BaseCapability):
    """
    The Core Capability provides basic utilities and Generative UI tools
    that allow the Agent to display interactive widgets (Charts, Tables, etc.)
    directly in the chat stream.
    """

    def get_tools(self, user: Any, session_id: str) -> List[Any]:
        """
        Returns the fundamental toolset for Aegra agents.
        """
        return [
            # Standard Agno math toolkit
            CalculatorTools(),
            
            # Generative UI (Agno v2 / SSE Widgets)
            generate_chart,
            show_data_table,
            show_media_card,
            show_option_list,
        ]

    def get_system_prompt_additions(self, user: Any) -> str:
        """
        Instructions for Core functionality.
        Focuses on guiding the LLM when to use specific UI tools.
        """
        return """
### CORE UI GUIDELINES
1. **Visualization:** When the user asks for trends, comparisons, or statistics, use `generate_chart`. 
   - Prefer 'bar' for categories and 'line' for time-series.
2. **Data Presentation:** Use `show_data_table` for lists exceeding 5 items or when precise numbers are required in a grid format.
4. **Rich Content:** Use `show_media_card` when sharing specific external links, images, or instructional videos.
"""