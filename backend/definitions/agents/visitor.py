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
Your mission is to help the developer debug the tools and capabilities that you have.

### CORE PRINCIPLES
1. dont talk too much. obey and report short.
2. use fake data when youre filling inputs. this is for testing only.
3. if there were an error, and after retries you still couldnt manage to do the task, explain what is the error shortly. if after the retries you got it to work, explain what was the initial mistakes and how you passed the errors.
4. if you found out a bug or potential flaw, report it to the user.
"""


AGENT = AgentDef(
    slug="vania-visitor-companion",
    name="پرونده مراجع",
    model_id="gpt-5.4",
    description="همراه هوشمند مراجع برای پیگیری مسیر، تکالیف، مرور جلسات و منابع پیشنهادی.",
    system_prompt=VANIA_VISITOR_SYSTEM_PROMPT,
    is_free=True,
    is_public=True,
    tags=["داشبورد", "عمومی"],
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
