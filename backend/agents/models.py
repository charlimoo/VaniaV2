from typing import Any, List, Optional, Union

from agno.models.message import Message
from agno.models.openai import OpenAIChat
from agno.tools.function import FunctionCall, FunctionExecutionResult
from agno.utils.timer import Timer

from .tool_result_sanitizer import sanitize_tool_result_content


class SanitizedOpenAIChat(OpenAIChat):
    def create_function_call_result(
        self,
        function_call: FunctionCall,
        success: bool,
        output: Optional[Union[List[Any], str]] = None,
        timer: Optional[Timer] = None,
        function_execution_result: Optional[FunctionExecutionResult] = None,
    ) -> Message:
        sanitized_output = sanitize_tool_result_content(output) if success else output
        return super().create_function_call_result(
            function_call=function_call,
            success=success,
            output=sanitized_output,
            timer=timer,
            function_execution_result=function_execution_result,
        )
