from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum
from users.models import CustomUser
from billing.models import UserWallet, UserRoleWallet

class Command(BaseCommand):
    help = 'Consolidates multiple Role Wallets into a single User Wallet (Phase 2 Migration)'

    def handle(self, *args, **kwargs):
        self.stdout.write("🚀 Starting wallet consolidation...")
        
        try:
            # Verify models exist (Safety check)
            _ = UserRoleWallet.objects.first()
        except Exception:
            self.stdout.write(self.style.WARNING("⚠️ UserRoleWallet model not accessible. Ensure migration is run before deleting the model code."))
            # In a real scenario, if models are deleted, we'd use raw SQL here.
            # Assuming models exist for the migration phase.
            return

        users = CustomUser.objects.all()
        total_users = users.count()
        processed_count = 0
        migrated_count = 0
        
        for user in users:
            # 1. Check if target wallet already exists
            if UserWallet.objects.filter(user=user).exists():
                # self.stdout.write(f"Skipping User {user.id} (Already has wallet)")
                processed_count += 1
                continue

            # 2. Find old wallets
            role_wallets = UserRoleWallet.objects.filter(user=user)
            
            if not role_wallets.exists():
                # Create empty wallet for user with no previous roles
                UserWallet.objects.create(user=user)
                processed_count += 1
                continue

            # 3. Aggregate funds
            totals = role_wallets.aggregate(
                total_plan=Sum('balance_plan'),
                total_paid=Sum('balance_paid')
            )
            
            final_plan = totals['total_plan'] or 0
            final_paid = totals['total_paid'] or 0
            
            # 4. Atomic Creation
            try:
                with transaction.atomic():
                    UserWallet.objects.create(
                        user=user,
                        balance_plan=final_plan,
                        balance_paid=final_paid,
                        daily_free_used=0  # Reset daily usage for a clean start
                    )
                    migrated_count += 1
                    processed_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"❌ Failed to migrate User {user.id}: {e}"))

            # Progress update
            if processed_count % 100 == 0:
                self.stdout.write(f"Processed {processed_count}/{total_users} users...")

        self.stdout.write(self.style.SUCCESS(f"✅ Consolidation Complete."))
        self.stdout.write(f"   - Total Users: {total_users}")
        self.stdout.write(f"   - Migrated: {migrated_count}")