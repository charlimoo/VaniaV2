import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, Optional


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AIProviderConfig:
    provider: str
    api_key: str
    base_url: Optional[str]


def _clean_base_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = value.strip()
    return cleaned.rstrip("/") if cleaned else None


@lru_cache(maxsize=1)
def get_ai_provider_config() -> AIProviderConfig:
    provider = (os.getenv("AI_PROVIDER", "openai") or "openai").strip().lower()
    if provider not in {"openai", "gapgpt"}:
        raise ValueError(
            f"Invalid AI_PROVIDER='{provider}'. Supported values: 'openai', 'gapgpt'."
        )

    if provider == "gapgpt":
        api_key = (os.getenv("GAPGPT_API_KEY") or "").strip()
        if not api_key:
            raise ValueError("Missing GAPGPT_API_KEY while AI_PROVIDER='gapgpt'.")
        base_url = _clean_base_url(os.getenv("GAPGPT_BASE_URL", "https://api.gapgpt.app/v1"))
    else:
        api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
        if not api_key:
            raise ValueError("Missing OPENAI_API_KEY while AI_PROVIDER='openai'.")
        base_url = _clean_base_url(os.getenv("OPENAI_BASE_URL"))

    logger.info(
        "AI provider selected: provider=%s, base_url=%s",
        provider,
        base_url or "default",
    )
    return AIProviderConfig(provider=provider, api_key=api_key, base_url=base_url)


def get_openai_client_kwargs() -> Dict[str, str]:
    cfg = get_ai_provider_config()
    kwargs: Dict[str, str] = {"api_key": cfg.api_key}
    if cfg.base_url:
        kwargs["base_url"] = cfg.base_url
    return kwargs


def get_agno_openai_kwargs() -> Dict[str, str]:
    return get_openai_client_kwargs()


def get_transcription_model_id() -> str:
    return (os.getenv("AI_TRANSCRIBE_MODEL") or "whisper-1").strip() or "whisper-1"

