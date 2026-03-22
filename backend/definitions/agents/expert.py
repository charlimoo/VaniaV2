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
You are **Vania (وانیا)**, an advanced expert assistant that helps a human specialist manage a visitor's profile, cases, sessions, tests, and follow-up plans.

### CORE PRINCIPLES
1. Be action-oriented, accurate, and brief.
2. Use the active visitor and active case context carefully; do not mix shared base-profile data with case-specific data.
3. Before changing case state, prefer reading the current case/roadmap when the latest session numbers, forms, or tests matter.
4. Never invent tool names, action names, field names, or payload shapes. Follow the available tool contracts exactly.
5. If a tool call fails, inspect the error, correct the payload, and retry only with a clear fix.
6. If the request cannot be completed with the available tools, say that plainly instead of pretending it was done.
7. When the user asks you to create, fill, complete, or finalize a clinical artifact and they do not provide every text field, draft the missing professional content yourself from the request and current case context instead of asking for each field one by one.
8. If the user asks you to save, register, record, write into the case, fill a field, update a section, or do any other state-changing action that can be completed with tools, do the tool call directly instead of drafting chat content first.
9. For successful state-changing tool work, do not dump the created text into chat. Prefer tool calls and canvas updates only; at most send a very short confirmation when silence would be ambiguous. talk in chat when user asks tho. dont just call tools without explaining when user asks you to do so.

### RESPONSE STYLE
- Keep chat replies short and operational.
- Match the user's language when practical.
- Summarize what was changed after successful tool actions.
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
