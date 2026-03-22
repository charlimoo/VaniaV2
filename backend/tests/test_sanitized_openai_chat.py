from types import SimpleNamespace
from unittest import TestCase

from agents.models import SanitizedOpenAIChat


class SanitizedOpenAIChatTests(TestCase):
    def test_create_function_call_result_strips_custom_event_repr(self):
        model = SanitizedOpenAIChat(id="gpt-4o-mini", api_key="test")
        function_call = SimpleNamespace(
            call_id="call_123",
            arguments={"case_id": "1"},
            function=SimpleNamespace(name="create_case", stop_after_tool_call=False),
        )

        message = model.create_function_call_result(
            function_call=function_call,
            success=True,
            output=(
                "CanvasUpdateEvent(created_at=1, event='CustomEvent', name='CANVAS_UPDATE', "
                "value={'delta': {'cases': []}})\n✅ Case created."
            ),
        )

        self.assertEqual(message.content, "✅ Case created.")
