from types import SimpleNamespace

from django.test import SimpleTestCase

from agents.session_metadata import (
    adjust_session_knowledge_file_count,
    apply_session_metadata_defaults,
    get_unsummarized_summary_progress,
)
from agents.utils import build_branch_history_prompt
from services import rag_service


class AgentSessionFeatureTests(SimpleTestCase):
    def test_branch_history_prompt_uses_previous_branch_messages_only(self):
        prompt = build_branch_history_prompt(
            [
                {"role": "user", "content": [{"type": "text", "text": "first"}]},
                {"role": "assistant", "content": [{"type": "text", "text": "reply"}]},
                {"role": "user", "content": [{"type": "text", "text": "current"}]},
            ]
        )

        self.assertIn("User: first", prompt)
        self.assertIn("Assistant: reply", prompt)
        self.assertNotIn("User: current", prompt)

    def test_session_metadata_tracks_unsummarized_progress_and_knowledge_count(self):
        session = SimpleNamespace(
            session_data={},
            runs=[
                SimpleNamespace(
                    status="completed",
                    metrics={"input_tokens": 10, "output_tokens": 5},
                    messages=[SimpleNamespace(role="user"), SimpleNamespace(role="assistant")],
                ),
                SimpleNamespace(
                    status="completed",
                    metrics={"input_tokens": 4, "output_tokens": 1},
                    messages=[SimpleNamespace(role="user"), SimpleNamespace(role="assistant")],
                ),
            ],
        )

        apply_session_metadata_defaults(session)
        progress = get_unsummarized_summary_progress(session, recent_raw_runs=1)

        self.assertEqual(progress["run_count"], 1)
        self.assertEqual(progress["unsummarized_run_count"], 1)
        self.assertEqual(progress["unsummarized_message_count"], 2)
        self.assertEqual(progress["unsummarized_token_count"], 15)

        adjust_session_knowledge_file_count(session, 2)
        self.assertTrue(session.session_data["has_session_knowledge"])
        self.assertEqual(session.session_data["session_knowledge_file_count"], 2)

    def test_render_session_knowledge_context_formats_hits(self):
        original_search = rag_service.search_session_knowledge
        try:
            rag_service.search_session_knowledge = lambda session_id, query, max_results=5: [
                SimpleNamespace(
                    meta_data={"filename": "doc.pdf", "page": 2},
                    content="relevant excerpt",
                    name="doc.pdf",
                )
            ]
            context = rag_service.render_session_knowledge_context("thread-1", "question")
        finally:
            rag_service.search_session_knowledge = original_search

        self.assertIn("doc.pdf (page 2)", context)
        self.assertIn("relevant excerpt", context)
