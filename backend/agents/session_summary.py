import logging
import time
from dataclasses import dataclass
from typing import Optional

from agno.models.message import Message
from agno.models.utils import get_model
from agno.session.summary import SessionSummary, SessionSummaryManager, SessionSummaryResponse

from .session_metadata import (
    advance_summary_checkpoint,
    get_completed_runs,
    get_unsummarized_summary_progress,
)


logger = logging.getLogger(__name__)


@dataclass
class TimedSessionSummaryManager(SessionSummaryManager):
    log_prefix: str = "[Run]"
    message_threshold: int = 10
    token_threshold: int = 150000
    recent_raw_runs: int = 3

    def _should_create_summary(self, session) -> tuple[bool, dict[str, int]]:
        progress = get_unsummarized_summary_progress(session, recent_raw_runs=self.recent_raw_runs)
        should_summarize = (
            progress["unsummarized_message_count"] > self.message_threshold
            or progress["unsummarized_token_count"] > self.token_threshold
        )
        logger.info(
            "%s Summary gate: unsummarized_messages=%s unsummarized_tokens=%s should_summarize=%s",
            self.log_prefix,
            progress["unsummarized_message_count"],
            progress["unsummarized_token_count"],
            should_summarize,
        )
        return should_summarize, progress

    def _get_runs_for_summary_delta(self, session, summarized_run_count: int) -> list:
        completed_runs = get_completed_runs(session)
        eligible_runs = completed_runs[:-self.recent_raw_runs] if len(completed_runs) > self.recent_raw_runs else []
        return eligible_runs[summarized_run_count:]

    def _build_incremental_summary_messages(self, session, summarized_run_count: int):
        self.model = get_model(self.model)
        if self.model is None:
            return None

        delta_runs = self._get_runs_for_summary_delta(session, summarized_run_count)
        if not delta_runs:
            return None

        response_format = self.get_response_format(self.model)
        transcript_lines = []
        for run in delta_runs:
            for message in getattr(run, "messages", None) or []:
                role = getattr(message, "role", None)
                content = str(getattr(message, "content", None) or "").strip()
                if role == "user" and content:
                    transcript_lines.append(f"User: {content}")
                elif role in {"assistant", "model"} and content:
                    transcript_lines.append(f"Assistant: {content}")

        if not transcript_lines:
            return None

        system_prompt = (
            "Update the long-term session summary.\n"
            "You will receive:\n"
            "1. The existing long-term summary, if any.\n"
            "2. Older conversation turns that should now be folded into that summary.\n\n"
            "Produce an updated concise summary and topics list that preserves important durable context.\n"
            "Do not repeat wording unnecessarily. Do not include the active recent turns that are still provided separately.\n"
            "Only include information grounded in the conversation.\n"
        )

        existing_summary = getattr(getattr(session, "summary", None), "summary", None)
        if existing_summary:
            system_prompt += f"\n<existing_summary>\n{existing_summary}\n</existing_summary>\n"

        system_prompt += "\n<older_conversation_to_fold_in>\n"
        system_prompt += "\n".join(transcript_lines)
        system_prompt += "\n</older_conversation_to_fold_in>\n"

        if response_format == {"type": "json_object"}:
            from agno.utils.prompts import get_json_output_prompt

            system_prompt += "\n" + get_json_output_prompt(SessionSummaryResponse)

        return [
            Message(role="system", content=system_prompt),
            Message(role="user", content="Return the updated session summary."),
        ]

    def create_session_summary(self, session, run_metrics=None) -> Optional[SessionSummary]:
        should_summarize, progress = self._should_create_summary(session)
        if not should_summarize:
            return None
        started_at = time.perf_counter()
        try:
            self.model = get_model(self.model)
            if self.model is None:
                return None
            messages = self._build_incremental_summary_messages(
                session,
                summarized_run_count=progress["run_count"] - progress["unsummarized_run_count"],
            )
            if messages is None:
                return None
            response_format = self.get_response_format(self.model)
            summary_response = self.model.response(messages=messages, response_format=response_format)
            summary = self._process_summary_response(summary_response, self.model)
            if summary is not None:
                session.summary = summary
                advance_summary_checkpoint(
                    session,
                    totals={
                        "run_count": progress["run_count"],
                        "message_count": progress["message_count"],
                        "token_count": progress["token_count"],
                    },
                )
            return summary
        finally:
            logger.info("%s Session summary finalize took %.1fms", self.log_prefix, (time.perf_counter() - started_at) * 1000)

    async def acreate_session_summary(self, session, run_metrics=None) -> Optional[SessionSummary]:
        should_summarize, progress = self._should_create_summary(session)
        if not should_summarize:
            return None
        started_at = time.perf_counter()
        try:
            self.model = get_model(self.model)
            if self.model is None:
                return None
            messages = self._build_incremental_summary_messages(
                session,
                summarized_run_count=progress["run_count"] - progress["unsummarized_run_count"],
            )
            if messages is None:
                return None
            response_format = self.get_response_format(self.model)
            summary_response = await self.model.aresponse(messages=messages, response_format=response_format)
            summary = self._process_summary_response(summary_response, self.model)
            if summary is not None:
                session.summary = summary
                advance_summary_checkpoint(
                    session,
                    totals={
                        "run_count": progress["run_count"],
                        "message_count": progress["message_count"],
                        "token_count": progress["token_count"],
                    },
                )
            return summary
        finally:
            logger.info("%s Session summary finalize took %.1fms", self.log_prefix, (time.perf_counter() - started_at) * 1000)
