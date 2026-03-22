from django.test import SimpleTestCase

from agents.tool_result_sanitizer import sanitize_tool_result_content
from canvas.events import CanvasUpdateEvent


class StreamToolResultSanitizationTests(SimpleTestCase):
    def test_removes_custom_event_repr_from_stringified_tool_result(self):
        raw_content = (
            "CanvasUpdateEvent(created_at=1, event='CustomEvent', name='CANVAS_UPDATE', "
            "value={'canvas_id': 'abc', 'delta': {'huge': 'payload'}})"
            "✅ Case created."
        )

        self.assertEqual(sanitize_tool_result_content(raw_content), "✅ Case created.")

    def test_keeps_textual_items_and_drops_custom_event_objects_from_lists(self):
        raw_content = [
            CanvasUpdateEvent(value={"canvas_id": "abc", "delta": {"selected_case_id": "1"}}),
            "✅ Clinical summary updated.",
        ]

        self.assertEqual(sanitize_tool_result_content(raw_content), "✅ Clinical summary updated.")

    def test_returns_fallback_when_only_custom_event_is_present(self):
        raw_content = CanvasUpdateEvent(value={"canvas_id": "abc", "delta": {}})

        self.assertEqual(sanitize_tool_result_content(raw_content), "Canvas updated.")
