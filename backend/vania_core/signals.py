# backend/vania_core/signals.py
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.db import transaction

# [FIX] Import Notification and SecureMessage models
from .models import (
    RoleVerificationRequest, 
    DoctorProfile, 
    PatientInvite, 
    TreatmentConnection,
    Notification,
    SecureMessage
)
from users.models import UserRole
from users.roles import is_expert

logger = logging.getLogger(__name__)

@receiver(post_save, sender=RoleVerificationRequest)
def process_role_approval(sender, instance, created, **kwargs):
    """
    Signal Handler: When an admin approves a verification request, this logic runs
    to automatically update the user's role and create their professional profile.
    """
    if not created and instance.status == RoleVerificationRequest.Status.APPROVED:
        logger.info(f"✅ [Signal] Processing approved verification for User {instance.user.id}")
        user = instance.user
        role = instance.target_role
        
        try:
            with transaction.atomic():
                # 1. Update Identity: Set the user's primary active role
                if user.role != role:
                    user.role = role
                    user.save(update_fields=['role'])
                    logger.info(f"   -> Role set to '{role.slug}' for User {user.id}")

                # 2. Create Profile (if the role is 'doctor')
                if is_expert(user):
                    specialty = instance.data.get('specialty', 'General Practice')
                    profile, created_profile = DoctorProfile.objects.get_or_create(
                        user=user,
                        defaults={'specialty': specialty, 'is_public': True}
                    )
                    if created_profile:
                        logger.info(f"   -> DoctorProfile created for User {user.id}")
                
                # [FIX] 3. Notify User of Approval
                Notification.objects.create(
                    recipient=user,
                    type=Notification.Type.SYSTEM,
                    title="درخواست شما تایید شد", # "Your request was approved"
                    message=f"درخواست شما برای نقش '{role.name}' توسط ادمین تایید شد."
                )

        except Exception as e:
            logger.error(f"❌ [Signal] Failed to process role approval for {user.id}: {e}", exc_info=True)

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def link_invites_on_signup(sender, instance, created, **kwargs):
    """
    Signal Handler: When a new user registers via OTP, this checks if their phone
    number matches any pending invitations from doctors and auto-links them.
    """
    if created and instance.phone_number:
        logger.info(f"🔗 [Signal] Checking for pending invites for new User {instance.phone_number}")
        pending_invites = PatientInvite.objects.filter(
            phone_number=instance.phone_number,
            status=PatientInvite.InviteStatus.SENT
        )
        
        if pending_invites.exists():
            with transaction.atomic():
                for invite in pending_invites:
                    # Auto-create the connection in a pending state for the patient to approve
                    TreatmentConnection.objects.create(
                        doctor=invite.doctor, 
                        patient=instance,
                        status=TreatmentConnection.Status.PENDING_PATIENT_APPROVAL,
                        notes=f"Auto-linked via Invite ID {invite.id}"
                    )
                    # Mark the invite as redeemed
                    invite.status = PatientInvite.InviteStatus.REGISTERED
                    invite.save()
                
                logger.info(f"   -> Auto-linked User {instance.id} to {pending_invites.count()} doctors.")


# [FIX] ADDED NEW SIGNAL FOR SECURE MESSAGES
@receiver(post_save, sender=SecureMessage)
def send_message_notification(sender, instance: SecureMessage, created, **kwargs):
    """
    When a new message is created, send a notification to the recipient.
    """
    # Only run for brand new messages to avoid spamming on edits
    if not created:
        return

    try:
        # Construct a deep link URL for the frontend to navigate to the correct chat
        deep_link = f"/dashboard/messages?userId={instance.sender.id}"

        # Create the notification object in the database
        Notification.objects.create(
            recipient=instance.recipient,
            sender=instance.sender,
            type=Notification.Type.NEW_MESSAGE,
            title=f"پیام جدید از {instance.sender.full_name or instance.sender.phone_number}",
            message=(instance.content[:70] + '...') if len(instance.content) > 70 else instance.content,
            payload={"url": deep_link}
        )
        logger.info(f"🔔 [Signal] Sent NEW_MESSAGE notification from {instance.sender.id} to {instance.recipient.id}")
    except Exception as e:
        # Log the error but don't crash the message sending process
        logger.error(f"❌ [Signal] Failed to create message notification: {e}")
