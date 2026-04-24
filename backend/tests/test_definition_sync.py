from django.test import TestCase, override_settings

from definitions.sync import DefinitionSync
from users.models import CustomUser


class DefinitionSyncAdminTests(TestCase):
    def test_sync_admin_user_creates_bootstrap_admin(self):
        DefinitionSync.sync_admin_user()

        user = CustomUser.objects.get(phone_number="09123456789")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_active)
        self.assertTrue(user.check_password("Adminadmin@123"))

    @override_settings(DEBUG=True)
    def test_sync_admin_user_resets_bootstrap_password_in_debug(self):
        user = CustomUser.objects.create_superuser(
            phone_number="09123456789",
            password="AnotherPass123!",
            email="admin@example.com",
            full_name="مدیر سیستم",
        )
        self.assertTrue(user.check_password("AnotherPass123!"))

        DefinitionSync.sync_admin_user()

        user.refresh_from_db()
        self.assertTrue(user.check_password("Adminadmin@123"))
