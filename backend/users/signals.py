import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import CustomUser, UserProfile
from billing.models import UserWallet

logger = logging.getLogger(__name__)

@receiver(post_save, sender=CustomUser)
def create_user_dependencies(sender, instance, created, **kwargs):
    """
    Ensures every user has a Profile and a Wallet upon creation.
    Replaces the old 'assign_default_role' logic.
    """
    if created:
        try:
            # 1. Create Profile
            UserProfile.objects.get_or_create(user=instance)
            
            # 2. Create Single Wallet (Zero Balance)
            UserWallet.objects.get_or_create(user=instance)
            
            logger.info(f"✅ [Signal] Initialized Wallet & Profile for User {instance.id}")
        except Exception as e:
            logger.error(f"❌ [Signal] Failed to init user dependencies: {e}")