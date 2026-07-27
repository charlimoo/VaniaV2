from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from billing.models import SubscriptionPlan, UserWallet
from users.models import CustomUser, ExpertProfession, UserRole
from vania_core.case_service import CaseService
from vania_core.models import DoctorProfile, TreatmentConnection


DEMO_ACCOUNTS = (
    {
        "profession": "psychologist",
        "expert_phone": "09120008101",
        "expert_name": "نگار فرهمند",
        "specialty": "روانشناس و مشاور",
        "visitor_phone": "09120008201",
        "visitor_name": "یلدا کریمی",
        "visitor_gender": "زن",
        "visitor_birth_date": "1993-04-12",
    },
    {
        "profession": "psychiatrist",
        "expert_phone": "09120008102",
        "expert_name": "دکتر سام رستگار",
        "specialty": "روان‌پزشک",
        "visitor_phone": "09120008202",
        "visitor_name": "مانی شریفی",
        "visitor_gender": "مرد",
        "visitor_birth_date": "1988-09-24",
    },
    {
        "profession": "general_doctor",
        "expert_phone": "09120008103",
        "expert_name": "دکتر آرش نیک‌پی",
        "specialty": "پزشک عمومی",
        "visitor_phone": "09120008203",
        "visitor_name": "مهسا توکلی",
        "visitor_gender": "زن",
        "visitor_birth_date": "1997-01-30",
    },
    {
        "profession": "lawyer",
        "expert_phone": "09120008104",
        "expert_name": "سارا دادفر",
        "specialty": "وکیل پایه یک دادگستری",
        "visitor_phone": "09120008204",
        "visitor_name": "پویان مرادی",
        "visitor_gender": "مرد",
        "visitor_birth_date": "1990-06-18",
    },
)


class Command(BaseCommand):
    help = "Create or refresh the isolated sales-demo accounts and their sample cases."

    def handle(self, *args, **options):
        if not settings.DEMO_ENVIRONMENT:
            raise CommandError("DEMO_ENVIRONMENT must be enabled before seeding demo accounts.")
        if not settings.DEMO_ACCOUNT_PASSWORD:
            raise CommandError("DEMO_ACCOUNT_PASSWORD must be configured.")

        expert_role = UserRole.objects.filter(slug="expert").first()
        visitor_role = UserRole.objects.filter(slug="visitor").first()
        if not expert_role or not visitor_role:
            raise CommandError("Run the definitions sync before seeding demo accounts.")

        with transaction.atomic():
            for index, account in enumerate(DEMO_ACCOUNTS, start=1):
                profession = ExpertProfession.objects.filter(slug=account["profession"], is_active=True).first()
                plan = SubscriptionPlan.objects.filter(
                    slug=f"expert-{account['profession']}-365d",
                    is_active=True,
                ).first()
                if not profession or not plan:
                    raise CommandError(f"Missing synced profession or plan for {account['profession']}.")

                expert, _ = CustomUser.objects.update_or_create(
                    phone_number=account["expert_phone"],
                    defaults={
                        "full_name": account["expert_name"],
                        "role": expert_role,
                        "expert_profession": profession,
                        "medical_license": f"DEMO-{account['profession'].upper()}-{4100 + index}",
                        "is_verified_doctor": True,
                        "is_expert_verified": True,
                        "expert_verified_at": timezone.now(),
                        "expert_verification_meta": {
                            "status": "approved",
                            "environment": "demo",
                            "seeded": True,
                        },
                        "is_active": True,
                    },
                )
                expert.set_password(settings.DEMO_ACCOUNT_PASSWORD)
                expert.save(update_fields=["password"])

                DoctorProfile.objects.update_or_create(
                    user=expert,
                    defaults={
                        "specialty": account["specialty"],
                        "bio": f"حساب نمایشی {account['specialty']} برای معرفی امکانات پلتفرم وانیا.",
                        "clinic_address": "تهران، مرکز دمو وانیا",
                        "is_public": False,
                        "accepting_new_patients": True,
                    },
                )

                visitor, _ = CustomUser.objects.update_or_create(
                    phone_number=account["visitor_phone"],
                    defaults={
                        "full_name": account["visitor_name"],
                        "role": visitor_role,
                        "is_active": True,
                    },
                )
                visitor.set_password(settings.DEMO_ACCOUNT_PASSWORD)
                visitor.save(update_fields=["password"])

                wallet, _ = UserWallet.objects.get_or_create(user=expert)
                wallet.active_plan = plan
                wallet.plan_expires_at = None
                wallet.balance_plan = Decimal("3000")
                wallet.save(update_fields=["active_plan", "plan_expires_at", "balance_plan", "updated_at"])

                TreatmentConnection.objects.update_or_create(
                    doctor=expert,
                    patient=visitor,
                    defaults={
                        "status": TreatmentConnection.Status.ACTIVE,
                        "notes": "اتصال آزمایشی محیط دمو",
                    },
                )
                CaseService.save_base_profile(
                    visitor,
                    {
                        "full_name": visitor.full_name,
                        "mobile_phone": visitor.phone_number,
                        "gender": account["visitor_gender"],
                        "birth_date": account["visitor_birth_date"],
                        "marital_status": "مجرد",
                        "education_level": "دارای مدرک دانشگاهی",
                        "job_status": "شاغل",
                    },
                    creator=expert,
                )
                if not CaseService.get_cases(visitor, expert.id):
                    CaseService.create_case(
                        visitor,
                        expert,
                        title=f"پرونده نمایشی {visitor.full_name}",
                    )

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(DEMO_ACCOUNTS)} experts and {len(DEMO_ACCOUNTS)} visitors."))
        for account in DEMO_ACCOUNTS:
            self.stdout.write(
                f"{account['profession']}: {account['expert_phone']} -> {account['visitor_phone']}"
            )
