from __future__ import annotations

import importlib
from decimal import Decimal
from typing import Iterable

from ...base import (
    AgentDef,
    DemoAccessMode,
    DemoCanvasMode,
    DemoConfigDef,
    DemoLimitScope,
)


_AGENTS_PACKAGE = __package__.rsplit(".", 1)[0]

PROMPT_WRAPPER_HEADER = "### VANIA EXPERT SPECIALTY WORKSPACE"

COMMON_EXTRA_CONFIG = {
    "input_requirements": {
        "requires_context": True,
        "context_label": "پرونده مراجع",
        "context_provider_endpoint": "/api/vania/my-visitors/",
        "context_header": "X-Target-Resource-ID",
    },
    "has_canvas": True,
    "featured": True,
    "featured_label": "ویژه متخصصین",
    "featured_variant": "expert_workspace",
    "default_width": 60,
    "show_voice_input": True,
    "allowed_file_types": [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ],
}

COMMON_DEMO_CONFIG = DemoConfigDef(
    access_mode=DemoAccessMode.ALLOWED,
    model_override="gpt-5-mini",
    message_limit_scope=DemoLimitScope.DAILY,
    message_limit_count=3,
    canvas_mode=DemoCanvasMode.LOCKED,
    canvas_placeholder_text="برای مشاهده ابزارهای پیشرفته، حساب خود را ارتقا دهید.",
)


def load_prompt(module_name: str) -> str:
    module = importlib.import_module(f"{_AGENTS_PACKAGE}.{module_name}")
    prompt = getattr(module, "AGENT_PROMPT", None)
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError(f"Module '{module.__name__}' does not expose a non-empty AGENT_PROMPT.")
    return prompt


def build_workspace_wrapper(*, profession_name: str, profession_slug: str) -> str:
    return f"""
{PROMPT_WRAPPER_HEADER}
You are operating as the dedicated Vania workspace agent for a {profession_name} inside the shared expert canvas.

### WORKSPACE CONTRACT
- This agent works inside the `vania_expert` capability and the `VANIA_PATIENT_MANAGER` canvas.
- Always ground yourself in the current workspace before making assumptions about the active visitor, active case, saved sessions, saved tests, roadmap state, or profession-limited tools.
- If there is no active visitor or case yet, browse accessible visitors/cases first and select the correct one before case work.
- Use shared base profile data only for `اطلاعات پایه` / `BASE_PROFILE_V1`.
- Use case-scoped tools for `پرونده`, `سند پشتیبان`, `تور نجات`, `شیوه و مصرف دارو`, `پیوست اندیشه`, `فایل‌ها`, case forms, case tests, and case analysis.
- In the case overview, the key writable areas may include `clinical_summary`, `forms_tests_analysis`, forms, and tests depending on the active profession policy.
- The exact visible tabs, sections, forms, tests, and tools are controlled by `backend/vania_core/profession_policy.py` and the `vania_expert` capability. Follow the currently available workspace state instead of assuming every feature is enabled.
- Do not override profession restrictions in chat. If a tab or tool family is unavailable for profession `{profession_slug}`, continue within the visible workspace and available toolset.
- Prefer saving work through tools/canvas updates rather than producing long draft-only chat answers when the user asked for state changes.

### TOOL USE GUIDANCE
- Read first when the latest saved state matters.
- For base-profile review, use the shared visitor profile and base form context.
- For case management, summary updates, tests, sessions, roadmap, appendix, medication, or files, work on the active case only.
- Match the Persian UI labels in the canvas exactly when referring to workspace sections.
""".strip()


def compose_prompt(*, profession_name: str, profession_slug: str, source_modules: Iterable[str]) -> str:
    parts = [build_workspace_wrapper(profession_name=profession_name, profession_slug=profession_slug)]
    for module_name in source_modules:
        parts.append(load_prompt(module_name).strip())
    return "\n\n".join(parts)


def build_specialty_agent(
    *,
    slug: str,
    name: str,
    description: str,
    tags: list[str],
    profession_slug: str,
    profession_name: str,
    source_modules: Iterable[str],
) -> AgentDef:
    return AgentDef(
        slug=slug,
        name=name,
        model_id="gpt-5.1",
        description=description,
        system_prompt=compose_prompt(
            profession_name=profession_name,
            profession_slug=profession_slug,
            source_modules=source_modules,
        ),
        is_free=False,
        audience="EXPERT",
        eligible_expert_professions=[profession_slug],
        requires_visitor_selector=True,
        demo_config=COMMON_DEMO_CONFIG,
        capabilities=["vania_expert"],
        tags=tags,
        cost_multiplier=Decimal("1.0"),
        enable_reasoning=False,
        reasoning_effort="none",
        static_tools=["duckduckgo"],
        default_open_canvases=["VANIA_PATIENT_MANAGER"],
        extra_config=COMMON_EXTRA_CONFIG,
    )
