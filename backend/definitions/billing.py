# backend/definitions/billing.py
from .base import ProductDef, DiscountDef, PlanDef

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

PSYCHIATRIST_AGENT_SLUGS = [
    "ravanyar-motekhases",
    "supervisor-mashaghel",
    "tarahi-jalasat-ravan-darman",
    "expert-psychiatrist-assistant",
    "vania-expert-assistant",
]

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

GENERAL_DOCTOR_AGENT_SLUGS = [
    "expert-general-doctor-assistant",
    "vania-expert-assistant",
]

# --- 1. Subscription Plans ---
# These define the tiers. Agents are linked here by their slugs.
PLANS = [
    PlanDef(
        slug="visitor-30d",
        name="اشتراک مراجعین ۳۰ روزه",
        description="پلن پایه مراجعین با دسترسی به ایجنت‌های عمومی و مراجع.",
        price=490000,
        duration_days=30,
        monthly_credits=600,
        included_agent_slugs=ALL_AUDIENCE_AGENT_SLUGS,
        audience="VISITOR",
    ),
    PlanDef(
        slug="visitor-90d",
        name="اشتراک مراجعین ۹۰ روزه",
        description="پلن اقتصادی مراجعین برای استفاده پایدار سه‌ماهه.",
        price=1290000,
        duration_days=90,
        monthly_credits=700,
        included_agent_slugs=ALL_AUDIENCE_AGENT_SLUGS,
        audience="VISITOR",
    ),
    PlanDef(
        slug="visitor-365d",
        name="اشتراک مراجعین سالانه",
        description="پلن کامل مراجعین با بهترین قیمت برای استفاده یک‌ساله.",
        price=4590000,
        duration_days=365,
        monthly_credits=900,
        included_agent_slugs=ALL_AUDIENCE_AGENT_SLUGS,
        audience="VISITOR",
    ),
    PlanDef(
        slug="expert-lawyer-30d",
        name="اشتراک وکلا ۳۰ روزه",
        description="پلن پایه وکلا با دسترسی به ایجنت‌های تخصصی حقوقی.",
        price=790000,
        duration_days=30,
        monthly_credits=1500,
        included_agent_slugs=LAWYER_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["lawyer"],
    ),
    PlanDef(
        slug="expert-lawyer-90d",
        name="اشتراک وکلا ۹۰ روزه",
        description="پلن اقتصادی وکلا برای استفاده سه‌ماهه.",
        price=2090000,
        duration_days=90,
        monthly_credits=1800,
        included_agent_slugs=LAWYER_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["lawyer"],
    ),
    PlanDef(
        slug="expert-lawyer-365d",
        name="اشتراک وکلا سالانه",
        description="پلن کامل وکلا با بهترین صرفه اقتصادی سالانه.",
        price=7590000,
        duration_days=365,
        monthly_credits=2400,
        included_agent_slugs=LAWYER_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["lawyer"],
    ),
    PlanDef(
        slug="expert-psychiatrist-30d",
        name="اشتراک روانپزشکان ۳۰ روزه",
        description="پلن پایه روانپزشکان با دسترسی به ایجنت‌های تخصصی مربوط.",
        price=890000,
        duration_days=30,
        monthly_credits=1700,
        included_agent_slugs=PSYCHIATRIST_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychiatrist"],
    ),
    PlanDef(
        slug="expert-psychiatrist-90d",
        name="اشتراک روانپزشکان ۹۰ روزه",
        description="پلن حرفه‌ای روانپزشکان برای استفاده پیوسته سه‌ماهه.",
        price=2390000,
        duration_days=90,
        monthly_credits=2000,
        included_agent_slugs=PSYCHIATRIST_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychiatrist"],
    ),
    PlanDef(
        slug="expert-psychiatrist-365d",
        name="اشتراک روانپزشکان سالانه",
        description="پلن کامل روانپزشکان با صرفه اقتصادی سالانه.",
        price=8690000,
        duration_days=365,
        monthly_credits=2700,
        included_agent_slugs=PSYCHIATRIST_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychiatrist"],
    ),
    PlanDef(
        slug="expert-psychologist-30d",
        name="اشتراک روانشناسان ۳۰ روزه",
        description="پلن پایه روانشناسان با دسترسی به ایجنت‌های تخصصی روانشناسی.",
        price=990000,
        duration_days=30,
        monthly_credits=1800,
        included_agent_slugs=PSYCHOLOGIST_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychologist"],
    ),
    PlanDef(
        slug="expert-psychologist-90d",
        name="اشتراک روانشناسان ۹۰ روزه",
        description="پلن حرفه‌ای روانشناسان برای استفاده سه‌ماهه.",
        price=2690000,
        duration_days=90,
        monthly_credits=2200,
        included_agent_slugs=PSYCHOLOGIST_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychologist"],
    ),
    PlanDef(
        slug="expert-psychologist-365d",
        name="اشتراک روانشناسان سالانه",
        description="پلن کامل روانشناسان با بیشترین صرفه اقتصادی سالانه.",
        price=9990000,
        duration_days=365,
        monthly_credits=3000,
        included_agent_slugs=PSYCHOLOGIST_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["psychologist"],
    ),
    PlanDef(
        slug="expert-general-doctor-30d",
        name="اشتراک پزشکان عمومی ۳۰ روزه",
        description="پلن پایه پزشکان عمومی با دسترسی به دستیار تخصصی پرونده.",
        price=790000,
        duration_days=30,
        monthly_credits=1400,
        included_agent_slugs=GENERAL_DOCTOR_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["general_doctor"],
    ),
    PlanDef(
        slug="expert-general-doctor-90d",
        name="اشتراک پزشکان عمومی ۹۰ روزه",
        description="پلن اقتصادی پزشکان عمومی برای استفاده سه‌ماهه.",
        price=2090000,
        duration_days=90,
        monthly_credits=1700,
        included_agent_slugs=GENERAL_DOCTOR_AGENT_SLUGS,
        audience="EXPERT",
        eligible_expert_professions=["general_doctor"],
    ),
    PlanDef(
        slug="expert-general-doctor-365d",
        name="اشتراک پزشکان عمومی سالانه",
        description="پلن کامل پزشکان عمومی با صرفه اقتصادی سالانه.",
        price=7590000,
        duration_days=365,
        monthly_credits=2200,
        included_agent_slugs=GENERAL_DOCTOR_AGENT_SLUGS,
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
        name="بسته ۵۰ سرمایه گفت‌وگو", 
        credits=50, 
        price=75000, 
        description="افزایش اعتبار حساب به میزان ۵۰ سرمایه گفت‌وگو (بدون انقضا)."
    ),
    ProductDef(
        name="بسته ۱۰۰ سرمایه گفت‌وگو", 
        credits=100, 
        price=140000, 
        description="افزایش اعتبار حساب به میزان ۱۰۰ سرمایه گفت‌وگو (بدون انقضا)."
    ),
    ProductDef(
        name="بسته ۲۵۰ سرمایه گفت‌وگو", 
        credits=250, 
        price=300000, 
        description="افزایش اعتبار حساب به میزان ۲۵۰ سرمایه گفت‌وگو (بدون انقضا)."
    ),
    ProductDef(
        name="بسته ۵۰۰ سرمایه گفت‌وگو", 
        credits=500, 
        price=500000, 
        description="افزایش اعتبار حساب به میزان ۵۰۰ سرمایه گفت‌وگو (بدون انقضا)."
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
