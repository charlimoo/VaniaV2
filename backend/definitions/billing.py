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
        name="اشتراک عمومی برنزی",
        description="طرح عمومی برنزی برای استفاده از دستیارهای عمومی وانیا.",
        price=690000,
        duration_days=30,
        monthly_credits=2600,
        included_agent_slugs=ALL_AUDIENCE_AGENT_SLUGS,
        audience="VISITOR",
    ),
    PlanDef(
        slug="visitor-90d",
        name="اشتراک عمومی نقره‌ای",
        description="طرح عمومی نقره‌ای برای استفاده پایدار از دستیارهای عمومی وانیا.",
        price=1966500,
        duration_days=90,
        monthly_credits=7800,
        included_agent_slugs=ALL_AUDIENCE_AGENT_SLUGS,
        audience="VISITOR",
    ),
    PlanDef(
        slug="visitor-365d",
        name="اشتراک عمومی طلایی",
        description="طرح عمومی طلایی برای استفاده بلندمدت از دستیارهای عمومی وانیا.",
        price=6624000,
        duration_days=365,
        monthly_credits=31200,
        included_agent_slugs=ALL_AUDIENCE_AGENT_SLUGS,
        audience="VISITOR",
    ),
    PlanDef(
        slug="expert-lawyer-30d",
        name="اشتراک حرفه‌ای وکلا - برنزی",
        description="طرح حرفه‌ای برنزی وکلا شامل همه دستیارهای عمومی وانیا به‌علاوه دستیارهای تخصصی حقوقی.",
        price=6670000,
        duration_days=30,
        monthly_credits=10000,
        included_agent_slugs=LAWYER_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["lawyer"],
    ),
    PlanDef(
        slug="expert-lawyer-90d",
        name="اشتراک حرفه‌ای وکلا - نقره‌ای",
        description="طرح حرفه‌ای نقره‌ای وکلا برای سه ماه استفاده از ابزارهای عمومی و تخصصی حقوقی.",
        price=18000000,
        duration_days=90,
        monthly_credits=30000,
        included_agent_slugs=LAWYER_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["lawyer"],
    ),
    PlanDef(
        slug="expert-lawyer-365d",
        name="اشتراک حرفه‌ای وکلا - طلایی",
        description="طرح حرفه‌ای طلایی وکلا با دسترسی سالانه به همه دستیارهای عمومی و تخصصی حقوقی.",
        price=64000000,
        duration_days=365,
        monthly_credits=120000,
        included_agent_slugs=LAWYER_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["lawyer"],
    ),
    PlanDef(
        slug="expert-psychiatrist-30d",
        name="اشتراک حرفه‌ای روانپزشکان - برنزی",
        description="طرح حرفه‌ای برنزی روانپزشکان شامل همه دستیارهای عمومی وانیا به‌علاوه دستیارهای تخصصی روانپزشکی.",
        price=10000000,
        duration_days=30,
        monthly_credits=30000,
        included_agent_slugs=PSYCHIATRIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychiatrist"],
    ),
    PlanDef(
        slug="expert-psychiatrist-90d",
        name="اشتراک حرفه‌ای روانپزشکان - نقره‌ای",
        description="طرح حرفه‌ای نقره‌ای روانپزشکان برای سه ماه استفاده از ابزارهای عمومی و تخصصی روانپزشکی.",
        price=27000000,
        duration_days=90,
        monthly_credits=90000,
        included_agent_slugs=PSYCHIATRIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychiatrist"],
    ),
    PlanDef(
        slug="expert-psychiatrist-365d",
        name="اشتراک حرفه‌ای روانپزشکان - طلایی",
        description="طرح حرفه‌ای طلایی روانپزشکان با دسترسی سالانه به همه دستیارهای عمومی و تخصصی.",
        price=96000000,
        duration_days=365,
        monthly_credits=360000,
        included_agent_slugs=PSYCHIATRIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychiatrist"],
    ),
    PlanDef(
        slug="expert-psychologist-30d",
        name="اشتراک حرفه‌ای روانشناسان - برنزی",
        description="طرح حرفه‌ای برنزی روانشناسان شامل همه دستیارهای عمومی وانیا به‌علاوه دستیارهای تخصصی روانشناسی.",
        price=10000000,
        duration_days=30,
        monthly_credits=30000,
        included_agent_slugs=PSYCHOLOGIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychologist"],
    ),
    PlanDef(
        slug="expert-psychologist-90d",
        name="اشتراک حرفه‌ای روانشناسان - نقره‌ای",
        description="طرح حرفه‌ای نقره‌ای روانشناسان برای سه ماه استفاده از ابزارهای عمومی و تخصصی روانشناسی.",
        price=27000000,
        duration_days=90,
        monthly_credits=90000,
        included_agent_slugs=PSYCHOLOGIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychologist"],
    ),
    PlanDef(
        slug="expert-psychologist-365d",
        name="اشتراک حرفه‌ای روانشناسان - طلایی",
        description="طرح حرفه‌ای طلایی روانشناسان با دسترسی سالانه به همه دستیارهای عمومی و تخصصی.",
        price=96000000,
        duration_days=365,
        monthly_credits=360000,
        included_agent_slugs=PSYCHOLOGIST_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychologist"],
    ),
    PlanDef(
        slug="expert-general-doctor-30d",
        name="اشتراک حرفه‌ای پزشکان - برنزی",
        description="طرح حرفه‌ای برنزی پزشکان شامل همه دستیارهای عمومی وانیا به‌علاوه دستیارهای تخصصی پزشکی.",
        price=5000000,
        duration_days=30,
        monthly_credits=15000,
        included_agent_slugs=GENERAL_DOCTOR_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["general_doctor"],
    ),
    PlanDef(
        slug="expert-general-doctor-90d",
        name="اشتراک حرفه‌ای پزشکان - نقره‌ای",
        description="طرح حرفه‌ای نقره‌ای پزشکان برای سه ماه استفاده از ابزارهای عمومی و تخصصی پزشکی.",
        price=13500000,
        duration_days=90,
        monthly_credits=45000,
        included_agent_slugs=GENERAL_DOCTOR_PLAN_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["general_doctor"],
    ),
    PlanDef(
        slug="expert-general-doctor-365d",
        name="اشتراک حرفه‌ای پزشکان - طلایی",
        description="طرح حرفه‌ای طلایی پزشکان با دسترسی سالانه به همه دستیارهای عمومی و تخصصی پزشکی.",
        price=48000000,
        duration_days=365,
        monthly_credits=180000,
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
