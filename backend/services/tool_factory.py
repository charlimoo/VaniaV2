# backend/services/tool_factory.py
import importlib
from typing import List, Any

# --- Agno Toolkits ---
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.yfinance import YFinanceTools
from agno.tools.calculator import CalculatorTools
# [REMOVED] ReasoningTools import is no longer needed here

from .models import AgentService

class ToolFactory:
    """
    Responsible for instantiating Toolkits and importing Custom Tools
    based on an AgentService configuration.
    """

    @staticmethod
    def get_static_tools(service: AgentService, user=None) -> List[Any]:
        """
        Returns initialized instances of Agno standard toolkits based on 
        the service configuration.
        """
        tools = []
        enabled_ids = service.static_tools or []

        # 1. Web Search
        if AgentService.StaticToolChoices.DUCKDUCKGO in enabled_ids:
            tools.append(DuckDuckGoTools())

        # 2. Finance
        if AgentService.StaticToolChoices.YFINANCE in enabled_ids:
            tools.append(YFinanceTools())

        # 3. Calculation
        if AgentService.StaticToolChoices.CALCULATOR in enabled_ids:
            tools.append(CalculatorTools())

        # [CHANGED] We REMOVED the automatic ReasoningTools injection here.
        # It is now handled conditionally in agents/factory.py based on the Model ID.

        return tools

    @staticmethod
    def get_custom_tools(service: AgentService) -> List[Any]:
        """
        Dynamically imports Python functions defined in the AvailableTool registry
        and linked to this service.
        """
        tools = []
        # Filter for tools that are linked to this service and globally active
        active_tools = service.custom_tools.filter(is_active=True)
        
        custom_tool_paths = active_tools.values_list('import_path', flat=True)

        for path in custom_tool_paths:
            try:
                # Expecting format: "custom_tools.filename.function_name"
                module_path, func_name = path.rsplit('.', 1)
                
                # Import the module dynamically
                module = importlib.import_module(module_path)
                
                # Get the function
                func = getattr(module, func_name)
                tools.append(func)
                
            except ImportError:
                print(f"❌ [ToolFactory] Could not import module: {path}")
            except AttributeError:
                print(f"❌ [ToolFactory] Function '{func_name}' not found in {module_path}")
            except Exception as e:
                print(f"❌ [ToolFactory] Error loading tool '{path}': {e}")
                
        return tools

    @staticmethod
    def get_all_tools(service: AgentService, user=None) -> List[Any]:
        """
        Combines static toolkits and custom python functions into a single list
        for the Agent.
        """
        return (
            ToolFactory.get_static_tools(service, user) + 
            ToolFactory.get_custom_tools(service)
        )