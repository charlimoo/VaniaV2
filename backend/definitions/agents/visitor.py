from decimal import Decimal

from ..base import (
    AgentDef,
    SuggestionDef,
    DemoConfigDef,
    DemoAccessMode,
    DemoLimitScope,
    DemoCanvasMode,
)


VANIA_VISITOR_SYSTEM_PROMPT = """
### IDENTITY
You are **Vania Companion**, a compassionate and supportive AI companion.
Your user is a visitor working with an expert in the Vania system.

### CORE MISSION
1. Help the visitor operationalize session outcomes between sessions.
2. Encourage completion of assigned tasks.
3. Support reflection on recent sessions and resources.
4. Keep continuity with the expert's plan.
5. Help the visitor understand the difference between `پرونده پایه` and each active `پرونده`.
5.  Never reveal raw test scores or direct interpretations of projective tests (TAT/Rorschach) to the patient. Use them exclusively for your internal analysis to inform your profile generation.
6. Do not talk to much. be short and consise

### BOUNDARIES
1. Do not replace professional expert judgment.
2. In crisis/safety risk, immediately direct the user to emergency services or their expert.
3. Keep communication empathetic, clear, and in Persian (Farsi).

### TOOLS
Use tools to load journey status, complete tasks/resources, and reflect on the latest session.
Always treat tasks, resources, and reflections as belonging to the selected case.
Use `get_current_medications` when the visitor asks about the active prescription plan.
If the user asks about case documents/files, use the case-file tools first. Start with listing or searching, then read only the minimum relevant excerpt.
Do not guess file contents from names alone and do not reproduce entire documents in chat.
"""


AGENT = AgentDef(
    slug="vania-visitor-companion",
    name="پرونده مراجع",
    model_id="gpt-5.1",
    description="همراه هوشمند مراجع برای پیگیری مسیر، تکالیف، مرور جلسات و منابع پیشنهادی.",
    system_prompt=VANIA_VISITOR_SYSTEM_PROMPT,
    is_free=True,
    tags=["داشبورد"],
    audience="VISITOR",
    demo_config=DemoConfigDef(
        access_mode=DemoAccessMode.ALLOWED,
        model_override="gpt-5-mini",
        message_limit_scope=DemoLimitScope.DAILY,
        message_limit_count=3,
        canvas_mode=DemoCanvasMode.LOCKED,
        canvas_placeholder_text="برای مشاهده ابزارهای پیشرفته، حساب خود را ارتقا دهید.",
    ),
    cost_multiplier=Decimal("1"),
    enable_reasoning=False,
    reasoning_effort="none",
    static_tools=["duckduckgo"],
    capabilities=["vania_visitor"],
    default_open_canvases=["VANIA_PATIENT_JOURNEY"],
    extra_config={
        "input_requirements": {
            "requires_context": False,
        },
        "has_canvas": True,
        "default_width": 50,
        "show_voice_input": True,
        "mobile_view_default": "canvas",
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
    user_guide="""
**همراه شما در مسیر**

1. ابتدا پرونده پایه یا پرونده موردنظر خود را انتخاب کنید.
2. وضعیت فعلی و تکالیف همان پرونده را با من مرور کنید.
3. نکات جلسه و منابع همان پرونده را با هم پیگیری می‌کنیم.
    """,
    suggestions=[
        SuggestionDef(
            title="وضعیت من ",
            subtitle="مرور برنامه و تکالیف",
            prompt="وضعیت پرونده فعال من را مرور کن و بگو امروز چه کارهایی باید انجام بدهم.",
        ),
        SuggestionDef(
            title="مرور جلسه ",
            subtitle="مرور نکات کلیدی",
            prompt="بیایید پرونده فعال را مرور کنیم و روی فلش‌کارت‌های مهم جلسه قبلی تمرکز کنیم.",
        ),
    ],
)


AGENTS = [AGENT]
