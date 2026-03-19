import time
from typing import Any, Optional

from agno.run.base import RunStatus


SESSION_KNOWLEDGE_FLAG_KEY = "has_session_knowledge"
SESSION_KNOWLEDGE_FILE_COUNT_KEY = "session_knowledge_file_count"

SUMMARY_CHECKPOINT_RUN_COUNT_KEY = "summary_checkpoint_run_count"
SUMMARY_CHECKPOINT_MESSAGE_COUNT_KEY = "summary_checkpoint_message_count"
SUMMARY_CHECKPOINT_TOKEN_COUNT_KEY = "summary_checkpoint_token_count"
SUMMARY_LAST_GENERATED_AT_KEY = "summary_last_generated_at"


def ensure_session_data(session: Any) -> dict:
    if not getattr(session, "session_data", None):
        session.session_data = {}
    return session.session_data


def apply_session_metadata_defaults(session_or_data: Any) -> dict:
    session_data = session_or_data if isinstance(session_or_data, dict) else ensure_session_data(session_or_data)
    session_data.setdefault(SESSION_KNOWLEDGE_FLAG_KEY, False)
    session_data.setdefault(SESSION_KNOWLEDGE_FILE_COUNT_KEY, 0)
    session_data.setdefault(SUMMARY_CHECKPOINT_RUN_COUNT_KEY, 0)
    session_data.setdefault(SUMMARY_CHECKPOINT_MESSAGE_COUNT_KEY, 0)
    session_data.setdefault(SUMMARY_CHECKPOINT_TOKEN_COUNT_KEY, 0)
    return session_data


def get_session_knowledge_flag(session: Any) -> Optional[bool]:
    session_data = getattr(session, "session_data", None) or {}
    value = session_data.get(SESSION_KNOWLEDGE_FLAG_KEY)
    if isinstance(value, bool):
        return value
    return None


def get_session_knowledge_file_count(session: Any) -> int:
    session_data = getattr(session, "session_data", None) or {}
    value = session_data.get(SESSION_KNOWLEDGE_FILE_COUNT_KEY)
    if isinstance(value, int):
        return max(0, value)
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def set_session_knowledge_metadata(session: Any, has_knowledge: bool, file_count: Optional[int] = None) -> None:
    session_data = ensure_session_data(session)
    count = get_session_knowledge_file_count(session) if file_count is None else max(0, file_count)
    if not has_knowledge:
        count = 0
    elif count <= 0:
        count = 1
    session_data[SESSION_KNOWLEDGE_FLAG_KEY] = has_knowledge
    session_data[SESSION_KNOWLEDGE_FILE_COUNT_KEY] = count


def adjust_session_knowledge_file_count(session: Any, delta: int) -> None:
    current = get_session_knowledge_file_count(session)
    new_count = max(0, current + delta)
    set_session_knowledge_metadata(session, has_knowledge=new_count > 0, file_count=new_count)


def _get_run_tokens(run: Any) -> int:
    metrics = getattr(run, "metrics", None)
    if metrics is None:
        return 0
    if hasattr(metrics, "to_dict"):
        metrics = metrics.to_dict()
    elif not isinstance(metrics, dict):
        metrics = metrics.__dict__
    input_tokens = int(metrics.get("input_tokens", metrics.get("prompt_tokens", 0)) or 0)
    output_tokens = int(metrics.get("output_tokens", metrics.get("completion_tokens", 0)) or 0)
    return input_tokens + output_tokens


def _get_chat_message_count(run: Any) -> int:
    messages = getattr(run, "messages", None) or []
    count = 0
    for message in messages:
        role = getattr(message, "role", None)
        if role in {"user", "assistant", "model"}:
            count += 1
    return count


def _is_completed_run(run: Any) -> bool:
    status = getattr(run, "status", None)
    return status not in {RunStatus.paused, RunStatus.cancelled, RunStatus.error}


def get_completed_runs(session: Any) -> list[Any]:
    runs = getattr(session, "runs", None) or []
    return [run for run in runs if _is_completed_run(run)]


def get_summary_totals(session: Any) -> dict[str, int]:
    runs = get_completed_runs(session)
    total_tokens = 0
    total_messages = 0
    for run in runs:
        total_tokens += _get_run_tokens(run)
        total_messages += _get_chat_message_count(run)
    return {
        "run_count": len(runs),
        "message_count": total_messages,
        "token_count": total_tokens,
    }


def get_eligible_summary_totals(session: Any, recent_raw_runs: int) -> dict[str, int]:
    runs = get_completed_runs(session)
    if recent_raw_runs > 0:
        runs = runs[:-recent_raw_runs] if len(runs) > recent_raw_runs else []

    total_tokens = 0
    total_messages = 0
    for run in runs:
        total_tokens += _get_run_tokens(run)
        total_messages += _get_chat_message_count(run)

    return {
        "run_count": len(runs),
        "message_count": total_messages,
        "token_count": total_tokens,
    }


def get_unsummarized_summary_progress(session: Any, recent_raw_runs: int = 0) -> dict[str, int]:
    session_data = ensure_session_data(session)
    totals = get_eligible_summary_totals(session, recent_raw_runs=recent_raw_runs)
    checkpoint_run_count = int(session_data.get(SUMMARY_CHECKPOINT_RUN_COUNT_KEY, 0) or 0)
    checkpoint_message_count = int(session_data.get(SUMMARY_CHECKPOINT_MESSAGE_COUNT_KEY, 0) or 0)
    checkpoint_token_count = int(session_data.get(SUMMARY_CHECKPOINT_TOKEN_COUNT_KEY, 0) or 0)
    return {
        **totals,
        "unsummarized_run_count": max(0, totals["run_count"] - checkpoint_run_count),
        "unsummarized_message_count": max(0, totals["message_count"] - checkpoint_message_count),
        "unsummarized_token_count": max(0, totals["token_count"] - checkpoint_token_count),
    }


def advance_summary_checkpoint(session: Any, totals: Optional[dict[str, int]] = None) -> dict[str, int]:
    session_data = ensure_session_data(session)
    totals = totals or get_summary_totals(session)
    session_data[SUMMARY_CHECKPOINT_RUN_COUNT_KEY] = totals["run_count"]
    session_data[SUMMARY_CHECKPOINT_MESSAGE_COUNT_KEY] = totals["message_count"]
    session_data[SUMMARY_CHECKPOINT_TOKEN_COUNT_KEY] = totals["token_count"]
    session_data[SUMMARY_LAST_GENERATED_AT_KEY] = int(time.time())
    return totals
