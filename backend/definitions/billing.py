# backend/definitions/billing.py
from .base import ProductDef, DiscountDef, PlanDef


def _merge_agent_slugs(*groups: list[str]) -> list[str]:
    merged: list[str] = []
    for group in groups:
        for slug in group:
            if slug not in merged:
                merged.append(slug)
    return merged

ALL_AUDIENCE_AGENT_SLUGS = [
    "HAM-edalat",
    "fal",
    "HAM-motalee",
    "HAM-shoghli",
    "HAM-moraje",
    "HAM-tahsili",
    "ravanyar",
    "vania-patient-companion",
    "vania-visitor-companion",
]

LAWYER_AGENT_SLUGS = [
    "supervisor-mashaghel",
    "vakil",
    "expert-lawyer-assistant",
    "vania-expert-assistant",
]
LAWYER_PLAN_AGENT_SLUGS = _merge_agent_slugs(ALL_AUDIENCE_AGENT_SLUGS, LAWYER_AGENT_SLUGS)

PSYCHIATRIST_AGENT_SLUGS = [
    "ravanyar-motekhases",
    "supervisor-mashaghel",
    "tarahi-darman",
    "tarahi-jalasat-darman",
    "tarahi-jalasat-daro-darman",
    "expert-psychiatrist-assistant",
    "vania-expert-assistant",
    "tashkil-parvande",
]
PSYCHIATRIST_PLAN_AGENT_SLUGS = _merge_agent_slugs(ALL_AUDIENCE_AGENT_SLUGS, PSYCHIATRIST_AGENT_SLUGS)

PSYCHOLOGIST_AGENT_SLUGS = [
    "ravanyar-motekhases",
    "ravansanj",
    "supervisor-mashaghel",
    "tarahi-darman",
    "tarahi-jalasat-darman",
    "tarahi-jalasat-daro-darman",
    "tarahi-jalasat-ravan-darman",
    "tashkil-parvande",
    "vania-doctor-assistant",
    "expert-psychologist-assistant",
    "vania-expert-assistant",
]
PSYCHOLOGIST_PLAN_AGENT_SLUGS = _merge_agent_slugs(ALL_AUDIENCE_AGENT_SLUGS, PSYCHOLOGIST_AGENT_SLUGS)

GENERAL_DOCTOR_AGENT_SLUGS = [
    "expert-general-doctor-assistant",
    "vania-expert-assistant",
]
GENERAL_DOCTOR_PLAN_AGENT_SLUGS = _merge_agent_slugs(ALL_AUDIENCE_AGENT_SLUGS, GENERAL_DOCTOR_AGENT_SLUGS)

# --- 1. Subscription Plans ---
# These define the tiers. Agents are linked here by their slugs.
PLANS = [
    PlanDef(
        slug="visitor-30d",
        name="اشتراک عمومی ماهانه",
        description="طرح عمومی ماهانه برای استفاده از دستیارهای عمومی وانیا.",
        price=690000,
        duration_days=30,
        monthly_credits=600,
        included_agent_slugs=ALL_AUDIENCE_AGENT_SLUGS,
        audience="VISITOR",
    ),
    PlanDef(
        slug="visitor-90d",
        name="اشتراک عمومی ۳ ماهه",
        description="طرح عمومی سه ماهه با قیمت مقرون‌به‌صرفه‌تر برای استفاده پایدار.",
        price=1966500,
        duration_days=90,
        monthly_credits=700,
        included_agent_slugs=ALL_AUDIENCE_AGENT_SLUGS,
        audience="VISITOR",
    ),
    PlanDef(
        slug="visitor-365d",
        name="اشتراک عمومی سالانه",
        description="طرح عمومی سالانه با ۲۰٪ صرفه‌جویی نسبت به خرید ماهانه.",
        price=6624000,
        duration_days=365,
        monthly_credits=900,
        included_agent_slugs=ALL_AUDIENCE_AGENT_SLUGS,
        audience="VISITOR",
    ),
    PlanDef(
        slug="expert-lawyer-30d",
        name="اشتراک حرفه‌ای وکلا - ماهانه",
        description="طرح حرفه‌ای ماهانه شامل همه دستیارهای عمومی وانیا به‌علاوه دستیارهای تخصصی حقوقی.",
        price=2000000,
        duration_days=30,
        monthly_credits=1500,
        included_agent_slugs=LAWYER_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["lawyer"],
    ),
    PlanDef(
        slug="expert-lawyer-90d",
        name="اشتراک حرفه‌ای وکلا - ۳ ماهه",
        description="طرح حرفه‌ای سه ماهه شامل همه دستیارهای عمومی وانیا به‌علاوه ابزارهای تخصصی حقوقی.",
        price=5700000,
        duration_days=90,
        monthly_credits=1800,
        included_agent_slugs=LAWYER_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["lawyer"],
    ),
    PlanDef(
        slug="expert-lawyer-365d",
        name="اشتراک حرفه‌ای وکلا - سالانه",
        description="طرح حرفه‌ای سالانه برای وکلا با دسترسی به همه دستیارهای عمومی و تخصصی حقوقی.",
        price=19200000,
        duration_days=365,
        monthly_credits=2400,
        included_agent_slugs=LAWYER_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["lawyer"],
    ),
    PlanDef(
        slug="expert-psychiatrist-30d",
        name="اشتراک حرفه‌ای روانپزشکان - ماهانه",
        description="طرح حرفه‌ای ماهانه شامل همه دستیارهای عمومی وانیا به‌علاوه دستیارهای تخصصی روانپزشکی.",
        price=2000000,
        duration_days=30,
        monthly_credits=1700,
        included_agent_slugs=PSYCHIATRIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychiatrist"],
    ),
    PlanDef(
        slug="expert-psychiatrist-90d",
        name="اشتراک حرفه‌ای روانپزشکان - ۳ ماهه",
        description="طرح حرفه‌ای سه ماهه شامل همه دستیارهای عمومی وانیا به‌علاوه ابزارهای تخصصی روانپزشکی.",
        price=5700000,
        duration_days=90,
        monthly_credits=2000,
        included_agent_slugs=PSYCHIATRIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychiatrist"],
    ),
    PlanDef(
        slug="expert-psychiatrist-365d",
        name="اشتراک حرفه‌ای روانپزشکان - سالانه",
        description="طرح حرفه‌ای سالانه برای روانپزشکان با دسترسی به همه دستیارهای عمومی و تخصصی.",
        price=19200000,
        duration_days=365,
        monthly_credits=2700,
        included_agent_slugs=PSYCHIATRIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychiatrist"],
    ),
    PlanDef(
        slug="expert-psychologist-30d",
        name="اشتراک حرفه‌ای روانشناسان - ماهانه",
        description="طرح حرفه‌ای ماهانه شامل همه دستیارهای عمومی وانیا به‌علاوه دستیارهای تخصصی روانشناسی.",
        price=2000000,
        duration_days=30,
        monthly_credits=1800,
        included_agent_slugs=PSYCHOLOGIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychologist"],
    ),
    PlanDef(
        slug="expert-psychologist-90d",
        name="اشتراک حرفه‌ای روانشناسان - ۳ ماهه",
        description="طرح حرفه‌ای سه ماهه شامل همه دستیارهای عمومی وانیا به‌علاوه ابزارهای تخصصی روانشناسی.",
        price=5700000,
        duration_days=90,
        monthly_credits=2200,
        included_agent_slugs=PSYCHOLOGIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychologist"],
    ),
    PlanDef(
        slug="expert-psychologist-365d",
        name="اشتراک حرفه‌ای روانشناسان - سالانه",
        description="طرح حرفه‌ای سالانه برای روانشناسان با دسترسی به همه دستیارهای عمومی و تخصصی.",
        price=19200000,
        duration_days=365,
        monthly_credits=3000,
        included_agent_slugs=PSYCHOLOGIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychologist"],
    ),
    PlanDef(
        slug="expert-general-doctor-30d",
        name="اشتراک حرفه‌ای پزشکان - ماهانه",
        description="طرح حرفه‌ای ماهانه شامل همه دستیارهای عمومی وانیا به‌علاوه دستیارهای تخصصی پزشکی.",
        price=2000000,
        duration_days=30,
        monthly_credits=1400,
        included_agent_slugs=GENERAL_DOCTOR_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["general_doctor"],
    ),
    PlanDef(
        slug="expert-general-doctor-90d",
        name="اشتراک حرفه‌ای پزشکان - ۳ ماهه",
        description="طرح حرفه‌ای سه ماهه شامل همه دستیارهای عمومی وانیا به‌علاوه ابزارهای تخصصی پزشکی.",
        price=5700000,
        duration_days=90,
        monthly_credits=1700,
        included_agent_slugs=GENERAL_DOCTOR_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["general_doctor"],
    ),
    PlanDef(
        slug="expert-general-doctor-365d",
        name="اشتراک حرفه‌ای پزشکان - سالانه",
        description="طرح حرفه‌ای سالانه برای پزشکان با دسترسی به همه دستیارهای عمومی و تخصصی.",
        price=19200000,
        duration_days=365,
        monthly_credits=2200,
        included_agent_slugs=GENERAL_DOCTOR_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["general_doctor"],
    ),
]

# --- 2. Storefront Products ---

# A. Plan Activation Products (Generated automatically from Plans)
# These appear in the "Plans" section of the billing page.
PLAN_PRODUCTS = [
    ProductDef(
        name=f"فعال‌سازی: {p.name}",
        price=p.price,
        description=p.description,
        linked_plan_slug=p.slug,
        is_active=p.is_active
    ) for p in PLANS
]

# B. Credit Top-ups (Standalone)
# These appear in the "Top-up" section. They add to 'balance_paid'.
CREDIT_PACKS = [
    ProductDef(
        name="بسته ۵۰ اعتبار گفتگو", 
        credits=50, 
        price=75000, 
        description="افزایش اعتبار قابل مصرف حساب به میزان ۵۰ اعتبار گفتگو (بدون انقضا)."
    ),
    ProductDef(
        name="بسته ۱۰۰ اعتبار گفتگو", 
        credits=100, 
        price=140000, 
        description="افزایش اعتبار قابل مصرف حساب به میزان ۱۰۰ اعتبار گفتگو (بدون انقضا)."
    ),
    ProductDef(
        name="بسته ۲۵۰ اعتبار گفتگو", 
        credits=250, 
        price=300000, 
        description="افزایش اعتبار قابل مصرف حساب به میزان ۲۵۰ اعتبار گفتگو (بدون انقضا)."
    ),
    ProductDef(
        name="بسته ۵۰۰ اعتبار گفتگو", 
        credits=500, 
        price=500000, 
        description="افزایش اعتبار قابل مصرف حساب به میزان ۵۰۰ اعتبار گفتگو (بدون انقضا)."
    ),
]

ALL_PRODUCTS = PLAN_PRODUCTS + CREDIT_PACKS

# --- 3. Discounts ---
DISCOUNTS = [
    DiscountDef(
        code="free", 
        percent=100, 
        is_active=True, 
        max_amount=5000000000, 
        # [FIX] Added 'Z' to indicate UTC timezone explicitly
        expiry_date="2026-11-11T00:00:00Z" 
    ),
    DiscountDef(
        code="WELCOME",
        percent=20,
        is_active=True,
        max_amount=100000,
        max_fund=10000000
    )
]
