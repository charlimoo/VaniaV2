import logging
from celery import shared_task
from django.conf import settings
from .sms_service import sms_service

logger = logging.getLogger(__name__)

@shared_task(name="users.tasks.send_sms_otp")
def send_sms_otp(phone_number: str, otp_code: str):
    """
    Asynchronously sends an SMS OTP via the configured provider (Najva).
    """
    try:
        app_name = getattr(settings, 'APP_NAME', 'Aegra')
        message = f"کد ورود به {app_name}: {otp_code}"
        
        # Use the centralized service (handles Live/Console mode internally)
        success = sms_service.send(phone_number, message)
        
        if success:
            return f"OTP SMS sent to {phone_number}"
        else:
            return f"OTP SMS failed for {phone_number}"

    except Exception as e:
        error_msg = f"Failed to send OTP to {phone_number}: {str(e)}"
        logger.error(error_msg)
        return error_msg

@shared_task(name="users.tasks.send_generic_sms")
def send_generic_sms(phone_number: str, message: str):
    """
    General purpose async SMS sender.
    Used for Payment Receipts, License Expiry Warnings, etc.
    """
    try:
        success = sms_service.send(phone_number, message)
        
        if success:
            return f"Generic SMS sent to {phone_number}"
        else:
            return f"Generic SMS failed for {phone_number}"
            
    except Exception as e:
        logger.error(f"Failed to send generic SMS: {e}")
        return f"Failed: {e}"