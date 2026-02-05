# backend/definitions/billing.py
from .base import ProductDef, DiscountDef, PlanDef

# --- 1. Subscription Plans ---
# These define the tiers. Agents are linked here by their slugs.
PLANS = [
    PlanDef(
        slug="starter-monthly",
        name="اشتراک مراجعین",
        description="مناسب برای استفاده روزمره",
        price=790000,
        duration_days=30,
        monthly_credits=500,
        included_agent_slugs=["vania-patient-companion"] 
    ),
    PlanDef(
        slug="pro-monthly",
        name="اشتراک پزشکان",
        description="مناسب برای استفاده مداوم",
        price=1490000,
        duration_days=30,
        monthly_credits=1500,
        included_agent_slugs=["vania-doctor-assistant"]
    ),
    PlanDef(
        slug="enterprise-annual",
        name="اشتراک پزشکان (سالانه)",
        description="مناسبت برای استفاده مداوم و طولانی مدت",
        price=19000000,
        duration_days=365,
        monthly_credits=5000,
        included_agent_slugs=["vania-doctor-assistant"]
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