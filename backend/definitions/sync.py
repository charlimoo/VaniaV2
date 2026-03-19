# backend/definitions/sync.py
import logging
from decimal import Decimal
from django.db import transaction
from django.utils.dateparse import parse_datetime
from django.utils.timezone import make_aware, is_naive
from django.contrib.auth import get_user_model  # [NEW] Import for User model

# --- Model Imports ---
from billing.models import BillingProduct, DiscountCode, SubscriptionPlan, BillingConfig
from services.models import AgentService, ServiceSuggestion
from services.models_canvas import CanvasType, AgentCanvasConfig
from vania_core.models import Location
from users.models import ExpertProfession
# --- Registries ---
from .billing import ALL_PRODUCTS, DISCOUNTS, PLANS
from .agents import AGENTS

from billing.models import BillingConfig, FAQ # [NEW] Import FAQ
from .support import SUPPORT_INFO, FAQS       # [NEW] Import Definitions

logger = logging.getLogger(__name__)

VANIA_LOCATIONS = [
    "تهران - شمال",
    "تهران - مرکز",
    "تهران - شرق",
    "تهران - غرب",
    "تهران - جنوب",
    "سعادت‌آباد / شهرک غرب",
    "ونک / ملاصدرا",
    "جردن / آفریقا",
    "پاسداران / دروس",
    "یوسف‌آباد / امیرآباد",
    "تجریش / نیاوران",
    "تهرانپارس",
    "صادقیه / آریاشهر",
    "انقلاب / ولیعصر",
]
    
class DefinitionSync:
    
    @staticmethod
    def sync_admin_user():
        """
        [NEW] Ensures a default Superuser exists for development/testing.
        """
        logger.info("\n🔄 [Sync] Checking Admin User...")
        User = get_user_model()
        
        admin_phone = "09123456789"
        admin_pass = "adminadmin"

        if not User.objects.filter(phone_number=admin_phone).exists():
            try:
                User.objects.create_superuser(
                    phone_number=admin_phone,
                    password=admin_pass,
                    email="admin@example.com",
                    full_name="مدیر سیستم"
                )
                logger.info(f"✅ [Sync] Admin created. Phone: {admin_phone} | Pass: {admin_pass}")
            except Exception as e:
                 logger.error(f"❌ [Sync] Failed to create admin user: {e}")
                 # We don't raise here to allow the rest of the sync to proceed
        else:
            logger.info("   [Sync] Admin user already exists. Skipping creation.")

    @staticmethod
    def sync_agents():
        logger.info(f"🔄 [Sync] Agents: {len(AGENTS)}")
        for a in AGENTS:
            demo_config_dict = a.demo_config.to_dict() if a.demo_config else {}
            agent_obj, _ = AgentService.objects.update_or_create(
                slug=a.slug,
                defaults={
                    "name": a.name,
                    "model_id": a.model_id,
                    "description": a.description,
                    "system_prompt": a.system_prompt,
                    "capabilities": a.capabilities,
                    "tags": a.tags,
                    "user_guide": a.user_guide,
                    "is_public": a.is_public,
                    "is_active": a.is_active,
                    "is_free": a.is_free,
                    "audience": a.audience,
                    "eligible_expert_professions": a.eligible_expert_professions,
                    "requires_visitor_selector": a.requires_visitor_selector,
                    "cost_multiplier": a.cost_multiplier,
                    "enable_reasoning": a.enable_reasoning,
                    "reasoning_effort": a.reasoning_effort,
                    "static_tools": a.static_tools,
                    "extra_config": a.extra_config,
                    "demo_config": demo_config_dict,
                }
            )
        
            
            ServiceSuggestion.objects.filter(service=agent_obj).delete()
            for s in a.suggestions:
                ServiceSuggestion.objects.create(
                    service=agent_obj, 
                    title=s.title, 
                    prompt=s.prompt, 
                    subtitle=s.subtitle
                )

            if a.default_open_canvases:
                for key in a.default_open_canvases:
                    CanvasType.objects.get_or_create(
                        component_key=key,
                        defaults={"name": key, "slug": key.lower()}
                    )
                
                canvases = CanvasType.objects.filter(component_key__in=a.default_open_canvases)
                for c in canvases:
                    AgentCanvasConfig.objects.update_or_create(
                        agent=agent_obj, 
                        canvas=c, 
                        defaults={'is_default_open': True}
                    )

    @staticmethod
    def sync_plans_and_products():
        logger.info(f"🔄 [Sync] Plans & Products")
        
        slug_to_plan_map = {}
        
        # 1. Sync Plans
        for p_def in PLANS:
            plan_obj, _ = SubscriptionPlan.objects.update_or_create(
                slug=p_def.slug,
                defaults={
                    "name": p_def.name,
                    "description": p_def.description,
                    "price": Decimal(p_def.price),
                    "duration_days": p_def.duration_days,
                    "included_credits": Decimal(p_def.monthly_credits),
                    "audience": p_def.audience,
                    "eligible_expert_professions": p_def.eligible_expert_professions,
                    "is_active": p_def.is_active
                }
            )
            slug_to_plan_map[p_def.slug] = plan_obj

            if p_def.included_agent_slugs:
                agents = AgentService.objects.filter(slug__in=p_def.included_agent_slugs)
                plan_obj.agents.set(agents)

        # 2. Sync Products
        for prod_def in ALL_PRODUCTS:
            linked_plan = None
            if prod_def.linked_plan_slug:
                linked_plan = slug_to_plan_map.get(prod_def.linked_plan_slug)
            
            BillingProduct.objects.update_or_create(
                name=prod_def.name,
                defaults={
                    "description": prod_def.description,
                    "price": Decimal(prod_def.price),
                    "credit_amount": Decimal(prod_def.credits),
                    "linked_plan": linked_plan,
                    "is_active": prod_def.is_active
                }
            )

    @staticmethod
    def sync_discounts():
        logger.info(f"🔄 [Sync] Discounts: {len(DISCOUNTS)}")
        for d in DISCOUNTS:
            expiry_aware = None
            if d.expiry_date:
                dt = parse_datetime(d.expiry_date)
                if dt and is_naive(dt):
                    expiry_aware = make_aware(dt)
                else:
                    expiry_aware = dt

            DiscountCode.objects.update_or_create(
                code=d.code,
                defaults={
                    "percent": d.percent,
                    "max_amount_per_usage": Decimal(d.max_amount) if d.max_amount else None,
                    "max_fund": Decimal(d.max_fund) if d.max_fund else None,
                    "is_active": d.is_active,
                    "expiry_date": expiry_aware
                }
            )

    @staticmethod
    def sync_billing_config():
        """
        Sets default Economy and Manual Payment settings.
        Now allows defining Token Rates and Free Credits directly here.
        """
        logger.info(f"🔄 [Sync] Global Billing Config")
        
        # We use update_or_create to ensure these defaults are applied
        BillingConfig.objects.update_or_create(
            pk=1,
            defaults={
                "currency_name": "سرمایه گفت‌وگو",
                "currency_symbol": "🪙",
                
                # --- ECONOMY SETTINGS ---
                # Defined here instead of Environment Variables
                "daily_free_credits": Decimal("5.0"), 
                "tokens_per_credit": 2000,
                
                # --- PAYMENT SETTINGS ---
                "bank_card_number": "5041721077886563",
                "bank_holder_name": "وانیا",
                "manual_payment_tips": "لطفاً مبلغ دقیق فاکتور را به شماره کارت بالا واریز کرده و کد پیگیری تراکنش را در کادر زیر وارد نمایید. تایید پرداخت ممکن است تا 24 ساعت زمان ببرد.",
                "support_phone": SUPPORT_INFO["phone"],
                "support_email": SUPPORT_INFO["email"],
                "support_address": SUPPORT_INFO["address"],
            }
        )

    @staticmethod
    def sync_faqs():
        logger.info(f"🔄 [Sync] FAQs: {len(FAQS)} items")
        # Optional: Clear old FAQs if you want strict syncing
        FAQ.objects.all().delete() 
        
        for item in FAQS:
            FAQ.objects.update_or_create(
                question=item.question,
                defaults={
                    "answer": item.answer,
                    "category": item.category,
                    "order": item.order,
                    "is_active": True
                }
            )


    @staticmethod
    def sync_locations():
        """
        Syncs predefined Vania locations from definitions to the DB.
        """
        logger.info(f"🔄 [Sync] Vania Locations: {len(VANIA_LOCATIONS)} items")
        for loc_name in VANIA_LOCATIONS:
            Location.objects.update_or_create(
                name=loc_name,
            )

    @staticmethod
    def sync_expert_professions():
        logger.info("🔄 [Sync] Expert Professions")
        professions = [
            {
                "slug": "psychologist",
                "name": "روان شناس",
                "description": "متخصص روان شناسی",
                "validation_kind": "mock_psychologist",
                "validation_config": {
                    "required_prefix": "PSY-",
                    "credential_label": "کد نظام روان‌شناسی",
                    "credential_placeholder": "مثال: PSY-12345",
                    "credential_help": "کدی که از سازمان نظام روان‌شناسی دریافت کرده‌اید را وارد کنید.",
                    "sample_code": "PSY-12345",
                },
            },
            {
                "slug": "psychiatrist",
                "name": "روان پزشک",
                "description": "متخصص روان پزشکی",
                "validation_kind": "mock_psychiatrist",
                "validation_config": {
                    "required_prefix": "PSYCH-",
                    "credential_label": "کد نظام پزشکی",
                    "credential_placeholder": "مثال: PSYCH-98765",
                    "credential_help": "کد نظام پزشکی خود را برای تایید تخصص وارد کنید.",
                    "sample_code": "PSYCH-98765",
                },
            },
            {
                "slug": "lawyer",
                "name": "وکیل",
                "description": "متخصص حقوق",
                "validation_kind": "mock_lawyer",
                "validation_config": {
                    "required_prefix": "LAW-",
                    "credential_label": "شناسه پروانه وکالت",
                    "credential_placeholder": "مثال: LAW-44556",
                    "credential_help": "شماره پروانه معتبر وکالت را وارد کنید.",
                    "sample_code": "LAW-44556",
                },
            },
            {
                "slug": "general_doctor",
                "name": "پزشک عمومی",
                "description": "پزشک عمومی",
                "validation_kind": "mock_general_doctor",
                "validation_config": {
                    "accepted_codes": ["123456"],
                    "credential_label": "کد اعتبارسنجی پزشک عمومی",
                    "credential_placeholder": "فعلا کد 123456 را وارد کنید",
                    "credential_help": "تا زمان اتصال به اعتبارسنجی اصلی، برای پزشک عمومی از کد 123456 استفاده کنید.",
                    "sample_code": "123456",
                },
            },
        ]
        for item in professions:
            ExpertProfession.objects.update_or_create(
                slug=item["slug"],
                defaults={
                    "name": item["name"],
                    "description": item["description"],
                    "is_active": True,
                    "validation_kind": item["validation_kind"],
                    "validation_config": item["validation_config"],
                },
            )
                    
    @classmethod
    def sync_all(cls):
        logger.info("--- Starting Definition Synchronization ---")
        # [NEW] Admin sync is often best done outside atomic block or handled carefully
        # but here it is fine as it uses get_user_model
        cls.sync_admin_user() 
        
        with transaction.atomic():
            cls.sync_billing_config()
            cls.sync_faqs()
            cls.sync_agents() 
            cls.sync_locations()
            cls.sync_expert_professions()
            cls.sync_plans_and_products()
            cls.sync_discounts()
        logger.info("--- Synchronization Complete ---")
