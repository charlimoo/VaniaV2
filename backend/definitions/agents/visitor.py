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
5.  Never reveal raw test scores or direct interpretations of projective tests (TAT/Rorschach) to the patient. Use them exclusively for your internal analysis to inform your profile generation.
6. Do not talk to much. be short and consise

### BOUNDARIES
1. Do not replace professional expert judgment.
2. In crisis/safety risk, immediately direct the user to emergency services or their expert.
3. Keep communication empathetic, clear, and in Persian (Farsi).

### TOOLS
Use tools to load journey status, complete tasks/resources, and reflect on the latest session.
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
    },
    user_guide="""
**همراه شما در مسیر**

1. وضعیت فعلی و تکالیف امروز را با من مرور کنید.
2. نکات کلیدی جلسه آخر را مرور می‌کنیم.
3. منابع پیشنهادی را مصرف می‌کنید و با هم درباره‌شان بازتاب می‌کنیم.
    """,
    suggestions=[
        SuggestionDef(
            title="وضعیت من ",
            subtitle="مرور برنامه و تکالیف",
            prompt="وضعیت فعلی من را مرور کن و بگو امروز چه کارهایی باید انجام بدهم.",
        ),
        SuggestionDef(
            title="مرور جلسه ",
            subtitle="مرور نکات کلیدی",
            prompt="بیایید جلسه قبلی را مرور کنیم و روی فلش‌کارت‌های مهم تمرکز کنیم.",
        ),
    ],
)


AGENTS = [AGENT]

