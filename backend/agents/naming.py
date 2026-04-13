# backend/agents/naming.py
import logging
import re

logger = logging.getLogger(__name__)

class TitleGenerator:
    def _normalize_title(self, text: str) -> str:
        cleaned = re.sub(r"\s+", " ", (text or "").strip())
        cleaned = re.sub(r"^[\s\-\–\—\.\,\!\?\:\؛\،\"'«»\(\)\[\]\{\}]+", "", cleaned)
        cleaned = re.sub(r"[\s\-\–\—\.\,\!\?\:\؛\،\"'«»\(\)\[\]\{\}]+$", "", cleaned)
        if not cleaned:
            return "گفتگوی جدید"

        words = cleaned.split(" ")
        short = " ".join(words[:4]).strip()
        if len(short) > 36:
            short = short[:36].rstrip()
        return short or "گفتگوی جدید"

    def generate_title(self, messages: list, user, session_id: str) -> str:
        """
        Generate a fast deterministic title from the first user message.
        This keeps naming truly parallel and avoids blocking on a second LLM call.
        """
        if not messages:
            return "گفتگوی جدید"

        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if role != "user":
                continue
            if isinstance(content, str):
                return self._normalize_title(content)
            if isinstance(content, list):
                text_parts = [
                    part.get("text", "")
                    for part in content
                    if isinstance(part, dict) and part.get("type") == "text"
                ]
                return self._normalize_title(" ".join(text_parts))

        return "گفتگوی جدید"

# Singleton
title_generator = TitleGenerator()
