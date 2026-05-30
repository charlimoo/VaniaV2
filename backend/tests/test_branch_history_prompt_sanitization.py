from django.test import SimpleTestCase

from agents.utils import (
    build_branch_history_messages,
    build_branch_history_prompt,
    clean_internal_prompt_content,
)


class BranchHistoryPromptSanitizationTests(SimpleTestCase):
    def test_extracts_visible_user_message_from_internal_prompt(self):
        raw_content = (
            "<active_branch_history>\n"
            "Use only this conversation branch as the prior chat history for the current turn.\n"
            "User: old path\n"
            "</active_branch_history>\n\n"
            "<current_user_message>\n"
            "لوکس باشه\n"
            "</current_user_message>"
        )

        self.assertEqual(clean_internal_prompt_content(raw_content), "لوکس باشه")

    def test_branch_history_messages_do_not_repersist_internal_prompt(self):
        raw_content = (
            "<active_branch_history>\n"
            "User: old path\n"
            "</active_branch_history>\n\n"
            "<current_user_message>لوکس باشه</current_user_message>"
        )

        messages = build_branch_history_messages([{"role": "user", "content": raw_content}])

        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0].content, "لوکس باشه")

    def test_branch_history_prompt_uses_clean_prior_messages(self):
        leaked_prior_message = (
            "<active_branch_history>\n"
            "User: old path\n"
            "</active_branch_history>\n\n"
            "<current_user_message>لوکس باشه</current_user_message>"
        )

        prompt = build_branch_history_prompt(
            [
                {"role": "user", "content": leaked_prior_message},
                {"role": "user", "content": "الان چی؟"},
            ]
        )

        self.assertIn("User: لوکس باشه", prompt)
        self.assertNotIn("<current_user_message>", prompt)
