# start of backend/vania_core/management/commands/seed_vania.py
import uuid
import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.conf import settings

# Models
from users.models import CustomUser, UserRole, UserContextEntry, ContextDefinition
from billing.models import UserWallet, SubscriptionPlan
from vania_core.models import (
    DoctorProfile, 
    TreatmentConnection, 
    SecureMessage, 
    Notification
)

class Command(BaseCommand):
    help = "Seeds the database with Vania test data (Doctors, Patients, Chats, Canvas Data)"

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("🌱 Starting Vania Seeding..."))

        try:
            with transaction.atomic():
                self.setup_roles_and_definitions()
                self.setup_plans()
                
                # --- Users ---
                dr_sara = self.create_doctor(
                    phone="09120000001", 
                    name="دکتر سارا احمدی", 
                    specialty="روانشناس بالینی",
                    bio="متخصص درمان اضطراب و افسردگی با رویکرد CBT."
                )
                
                dr_ali = self.create_doctor(
                    phone="09120000002", 
                    name="دکتر علی کریمی", 
                    specialty="پزشک عمومی",
                    bio="مشاوره عمومی و پایش سلامت خانواده."
                )

                pat_mina = self.create_patient("09120000003", "مینا عباسی")
                pat_reza = self.create_patient("09120000004", "رضا رضایی")

                # --- Connections ---
                self.connect_users(dr_sara, pat_mina) # Active
                self.connect_users(dr_sara, pat_reza) # Active
                self.connect_users(dr_ali, pat_mina)  # Active
                
                # Pending Request
                TreatmentConnection.objects.create(
                    doctor=dr_ali,
                    patient=pat_reza,
                    status=TreatmentConnection.Status.PENDING_DOCTOR_APPROVAL,
                    request_data={"main_concern": "سردرد مزمن", "history_brief": "دو هفته است که درد دارم"}
                )

                # --- Canvas Data (The important part for testing UI) ---
                self.seed_clinical_sessions(dr_sara, pat_mina)
                self.seed_tasks(dr_sara, pat_mina)
                self.seed_clinical_sessions(dr_ali, pat_mina)

                # --- Chat Messages ---
                self.seed_chat(dr_sara, pat_mina)

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Seeding Failed: {e}"))
            raise e

        self.stdout.write(self.style.SUCCESS("✅ Seeding Complete!"))
        self.stdout.write(self.style.SUCCESS("------------------------------------------------"))
        self.stdout.write(f"🔑 Doctor 1: 09120000001 (Pass: 12345678)")
        self.stdout.write(f"🔑 Patient 1: 09120000003 (Pass: 12345678)")
        self.stdout.write(self.style.SUCCESS("------------------------------------------------"))

    # =========================================================================
    # Helpers
    # =========================================================================

    def setup_roles_and_definitions(self):
        UserRole.objects.get_or_create(slug="doctor", defaults={"name": "پزشک"})
        UserRole.objects.get_or_create(slug="patient", defaults={"name": "بیمار"})
        
        ContextDefinition.objects.get_or_create(key="clinical_session_log", defaults={"description": "Session History"})
        ContextDefinition.objects.get_or_create(key="patient_tasks", defaults={"description": "Todo List"})

    def setup_plans(self):
        self.plan, _ = SubscriptionPlan.objects.get_or_create(
            slug="pro-monthly-seed",
            defaults={
                "name": "اشتراک حرفه‌ای (تست)",
                "price": 0,
                "duration_days": 365,
                "included_credits": 10000
            }
        )

    def create_doctor(self, phone, name, specialty, bio):
        user, created = CustomUser.objects.get_or_create(phone_number=phone)
        user.set_password("12345678")
        user.full_name = name
        user.role = UserRole.objects.get(slug="doctor")
        user.save()

        # Update Profile
        DoctorProfile.objects.update_or_create(
            user=user,
            defaults={
                "specialty": specialty,
                "bio": bio,
                "is_public": True,
                "accepting_new_patients": True
            }
        )
        
        self.fund_wallet(user)
        return user

    def create_patient(self, phone, name):
        user, created = CustomUser.objects.get_or_create(phone_number=phone)
        user.set_password("12345678")
        user.full_name = name
        user.role = UserRole.objects.get(slug="patient")
        user.save()
        
        self.fund_wallet(user)
        return user

    def fund_wallet(self, user):
        wallet, _ = UserWallet.objects.get_or_create(user=user)
        wallet.active_plan = self.plan
        wallet.plan_expires_at = timezone.now() + timedelta(days=365)
        wallet.balance_plan = 5000
        wallet.save()

    def connect_users(self, doctor, patient):
        TreatmentConnection.objects.update_or_create(
            doctor=doctor,
            patient=patient,
            defaults={"status": TreatmentConnection.Status.ACTIVE}
        )

    def seed_clinical_sessions(self, doctor, patient):
        """Creates session logs visible in the 'History' tab of Patient Manager."""
        definition = ContextDefinition.objects.get(key="clinical_session_log")
        
        # Session 1: 2 Weeks ago
        date1 = timezone.now() - timedelta(days=14)
        UserContextEntry.objects.create(
            user=patient,
            definition=definition,
            created_by=doctor,
            data={
                "date": date1.isoformat(),
                "doctor_name": doctor.full_name,
                "summary": "بیمار با شکایت اضطراب مراجعه کرد. علائم فیزیکی شامل تپش قلب. بحث درباره مدیریت استرس.",
                "private_notes": "به نظر می‌رسد استرس شغلی عامل اصلی باشد.",
                "mood_rating": 4
            }
        )

        # Session 2: Yesterday
        date2 = timezone.now() - timedelta(days=1)
        UserContextEntry.objects.create(
            user=patient,
            definition=definition,
            created_by=doctor,
            data={
                "date": date2.isoformat(),
                "doctor_name": doctor.full_name,
                "summary": "وضعیت بهبود یافته است. تمرینات تنفسی انجام شده. خواب منظم‌تر شده.",
                "private_notes": "پیشرفت عالی. ادامه درمان فعلی.",
                "mood_rating": 7
            }
        )

    def seed_tasks(self, doctor, patient):
        """Creates the Task List visible in 'Tasks' tab."""
        definition = ContextDefinition.objects.get(key="patient_tasks")
        
        # Ensure we only have one active entry per patient for tasks (Singleton pattern)
        UserContextEntry.objects.filter(user=patient, definition=definition).update(is_active=False)

        UserContextEntry.objects.create(
            user=patient,
            definition=definition,
            created_by=doctor,
            is_active=True,
            data={
                "tasks": [
                    {
                        "id": str(uuid.uuid4()),
                        "text": "مصرف دارو قبل از خواب",
                        "status": "PENDING",
                        "doctor_name": doctor.full_name,
                        "due_date": (timezone.now() + timedelta(days=1)).isoformat(),
                        "created_at": timezone.now().isoformat()
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "text": "پیاده‌روی روزانه ۲۰ دقیقه",
                        "status": "DONE",
                        "doctor_name": doctor.full_name,
                        "due_date": (timezone.now() - timedelta(days=1)).isoformat(),
                        "created_at": (timezone.now() - timedelta(days=2)).isoformat()
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "text": "تکمیل پرسشنامه خواب",
                        "status": "PENDING",
                        "doctor_name": doctor.full_name,
                        "due_date": (timezone.now() + timedelta(days=2)).isoformat(),
                        "created_at": timezone.now().isoformat()
                    }
                ]
            }
        )

    def seed_chat(self, doctor, patient):
        """Creates secure messages between users."""
        msgs = [
            (doctor, "سلام، حالتون چطوره؟ تمرینات رو انجام دادید؟"),
            (patient, "سلام دکتر. بله، بهترم اما هنوز خوابم تنظیم نیست."),
            (doctor, "نگران نباشید، زمان می‌برد. برای این هفته تمرکز رو روی ساعت خواب ثابت بذارید."),
            (patient, "چشم، ممنون."),
        ]
        
        base_time = timezone.now() - timedelta(hours=2)
        
        for i, (sender, content) in enumerate(msgs):
            recipient = patient if sender == doctor else doctor
            SecureMessage.objects.create(
                sender=sender,
                recipient=recipient,
                content=content,
                created_at=base_time + timedelta(minutes=i*5),
                is_read=True
            )
            
        # Add a notification
        Notification.objects.create(
            recipient=patient,
            sender=doctor,
            title="پیام جدید",
            message="دکتر سارا احمدی به شما پیام داد.",
            type="NEW_MESSAGE"
        )
# end of backend/vania_core/management/commands/seed_vania.py