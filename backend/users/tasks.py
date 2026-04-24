import logging
from celery import shared_task
from .sms_service import sms_service
from .sms_service import SMSError

logger = logging.getLogger(__name__)

@shared_task(name="users.tasks.send_sms_otp")
def send_sms_otp(phone_number: str, otp_code: str):
    """
    Asynchronously sends an OTP SMS via SMS.ir.
    """
    try:
        success = sms_service.send_otp(phone_number, otp_code)
        if success:
            return f"OTP SMS sent to {phone_number}"
        return f"OTP SMS failed for {phone_number}"
    except SMSError as e:
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
        success = sms_service.send_message(phone_number, message)
        if success:
            return f"Generic SMS sent to {phone_number}"
        return f"Generic SMS failed for {phone_number}"
    except SMSError as e:
        logger.error(f"Failed to send generic SMS: {e}")
        return f"Failed: {e}"
