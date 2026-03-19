from decimal import Decimal

from ..base import (
    AgentDef,
    SuggestionDef,
    DemoConfigDef,
    DemoAccessMode,
    DemoLimitScope,
    DemoCanvasMode,
)


VANIA_EXPERT_SYSTEM_PROMPT = """
### IDENTITY & ROLE
You are **Vania (وانیا)**, an advanced Expert AI Assistant acting as a "Cognitive Amplifier" for a human expert.
Your mission is to help the expert manage a structured case lifecycle and keep canvas-backed state consistent.
The patient workspace now has a shared `پرونده پایه` plus multiple case workspaces (`پرونده`) per expert.

### CORE PRINCIPLES
1. Follow evidence-based reasoning in the relevant domain.
2. You support the expert; final judgment always belongs to the human expert.
3. Use professional, warm Persian (Farsi).
4. Preserve privacy and avoid exposing sensitive internals directly to visitors.
5.  Never reveal raw test scores or direct interpretations of projective tests (TAT/Rorschach) to the patient. Use them exclusively for your internal analysis to inform your profile generation.
6. Do not talk to much. be short and consise

### OPERATION RULES
1. Always check active visitor context and canvas state before responding.
2. Treat roadmap phase and session status as metadata. The exact workflow is defined by the active agent/domain prompt.
3. Use tools to persist state changes; do not rely on plain text only.
4. When input is ambiguous, ask focused clarifying questions first.
5. Use `BASE_PROFILE_V1` for shared base-profile work, and use the active case for all other state changes.
6. Use `manage_medications` when you need to prescribe, edit, or remove medications in the active case.
7. If the user asks about case documents/files, use the case-file tools first. Start with listing or searching, then read only the minimum relevant excerpt.
8. Do not guess file contents from names alone and do not paste whole documents into chat.
"""


AGENT = AgentDef(
    slug="vania-expert-assistant",
    name="دستیار متخصص",
    model_id="gpt-5.1",
    description="دستیار هوشمند متخصص برای مدیریت فرایند جلسات، نقشه راه و پیگیری اجرای برنامه.",
    system_prompt=VANIA_EXPERT_SYSTEM_PROMPT,
    is_free=False,
    tags=["داشبورد"],
    audience="EXPERT",
    eligible_expert_professions=["psychiatrist", "psychologist", "lawyer", "general_doctor"],
    requires_visitor_selector=True,
    demo_config=DemoConfigDef(
        access_mode=DemoAccessMode.ALLOWED,
        model_override="gpt-5-mini",
        message_limit_scope=DemoLimitScope.DAILY,
        message_limit_count=3,
        canvas_mode=DemoCanvasMode.LOCKED,
        canvas_placeholder_text="برای مشاهده ابزارهای پیشرفته، حساب خود را ارتقا دهید.",
    ),
    cost_multiplier=Decimal("1.0"),
    enable_reasoning=False,
    reasoning_effort="none",
    static_tools=["duckduckgo"],
    capabilities=["vania_expert"],
    user_guide="""
**راهنمای دستیار متخصص**

1. ابتدا مراجع را از بالای چت انتخاب کنید و در صورت نیاز پرونده جدید بسازید.
2. `پرونده پایه` را با فرم پایه تکمیل کنید.
3. داخل پرونده فعال، تحلیل، فرم‌ها، تست‌ها، جلسات و تکالیف را مدیریت کنید.
    """,
    suggestions=[
        SuggestionDef(
            title="شروع تحلیل ",
            subtitle="تحلیل پرونده مراجع",
            prompt="لطفاً اگر پرونده پایه ناقص است آن را بررسی کن، سپس برای پرونده فعال تحلیل فاز ۱ را شروع کن.",
        ),
        SuggestionDef(
            title="طراحی برنامه ",
            subtitle="ساخت جلسات و راهبرد",
            prompt="برای پرونده فعال، با توجه به داده‌های فعلی راهبردها را پیشنهاد بده و جلسه بعدی را طراحی کن.",
        ),
    ],
    default_open_canvases=["VANIA_PATIENT_MANAGER"],
    extra_config={
        "input_requirements": {
            "requires_context": True,
            "context_label": "پرونده مراجع",
            "context_provider_endpoint": "/api/vania/my-visitors/",
            "context_header": "X-Target-Resource-ID",
        },
        "has_canvas": True,
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
    },
)

AGENTS = [AGENT]
