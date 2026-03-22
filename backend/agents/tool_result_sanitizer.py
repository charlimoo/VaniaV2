import json
import re
from typing import Any

from agno.run.agent import CustomEvent


_CUSTOM_EVENT_TOKEN_RE = re.compile(r"\b[A-Za-z_][A-Za-z0-9_]*Event\(")


def _strip_custom_event_repr(text: str) -> str:
    if not text:
        return ""

    result_parts: list[str] = []
    cursor = 0
    text_length = len(text)

    while cursor < text_length:
        match = _CUSTOM_EVENT_TOKEN_RE.search(text, cursor)
        if not match:
            result_parts.append(text[cursor:])
            break

        result_parts.append(text[cursor:match.start()])
        depth = 0
        in_string = False
        string_quote = ""
        escape_next = False
        index = match.end() - 1

        while index < text_length:
            char = text[index]
            if in_string:
                if escape_next:
                    escape_next = False
                elif char == "\\":
                    escape_next = True
                elif char == string_quote:
                    in_string = False
            else:
                if char in {"'", '"'}:
                    in_string = True
                    string_quote = char
                elif char == "(":
                    depth += 1
                elif char == ")":
                    depth -= 1
                    if depth == 0:
                        index += 1
                        break
            index += 1

        if depth != 0:
            result_parts.append(text[match.start():])
            break

        cursor = index

    return "".join(result_parts).strip()


def sanitize_tool_result_content(raw_content: Any) -> str:
    if raw_content is None:
        return "Result unavailable"

    if isinstance(raw_content, CustomEvent):
        return "Canvas updated."

    if isinstance(raw_content, (list, tuple)):
        sanitized_items = [sanitize_tool_result_content(item) for item in raw_content]
        sanitized_items = [item for item in sanitized_items if item and item != "Canvas updated."]
        return "\n".join(sanitized_items).strip() or "Canvas updated."

    if isinstance(raw_content, dict):
        try:
            return json.dumps(raw_content, ensure_ascii=False)
        except Exception:
            return str(raw_content)

    text = _strip_custom_event_repr(str(raw_content))
    return text or "Canvas updated."
