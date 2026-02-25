from __future__ import annotations

from typing import Any


TITLE_KEYS = (
    "title",
    "front",
    "question",
    "heading",
    "name",
    "technique",
    "topic",
    "key_point",
    "keypoint",
    "عنوان",
    "تیتر",
)

CONTENT_KEYS = (
    "content",
    "back",
    "answer",
    "description",
    "details",
    "body",
    "note",
    "text",
    "توضیح",
    "شرح",
    "متن",
)


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value).strip()
    return ""


def _pick(obj: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        if key in obj:
            text = _to_text(obj.get(key))
            if text:
                return text
    return ""


def normalize_flashcards(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []

    normalized: list[dict[str, str]] = []
    for item in raw:
        title = ""
        content = ""

        if isinstance(item, str):
            title = item.strip()
        elif isinstance(item, dict):
            title = _pick(item, TITLE_KEYS)
            content = _pick(item, CONTENT_KEYS)

            if not title and not content:
                # Last-resort fallback for unknown object shapes.
                text_values = [_to_text(v) for v in item.values()]
                text_values = [v for v in text_values if v]
                if len(text_values) == 1:
                    title = text_values[0]
                elif len(text_values) >= 2:
                    title, content = text_values[0], text_values[1]
        else:
            title = _to_text(item)

        if title or content:
            normalized.append({"title": title, "content": content})

    return normalized
