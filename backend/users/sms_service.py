import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

class SMSService:
    """
    A centralized service to handle sending SMS messages via the Najva API.
    """
    API_URL = "https://sms.najva.com/v2/sms/send"

    def __init__(self):
        self.api_key = getattr(settings, 'NAJVA_API_KEY', None)
        self.sender_id = getattr(settings, 'NAJVA_SENDER_ID', None)
        self.mode = getattr(settings, 'SMS_SERVICE_MODE', 'CONSOLE').upper()
        self.is_live = (self.mode == 'LIVE')
        
        if self.is_live:
            if self.api_key and self.sender_id:
                logger.info("✅ SMS Service initialized in LIVE mode.")
            else:
                logger.error("⚠️ SMS Service set to LIVE, but missing credentials.")
        else:
            logger.info("ℹ️ SMS Service initialized in CONSOLE mode (Mock).")

    def send(self, recipient: str, message: str) -> bool:
        """
        Sends an SMS message.
        """
        # --- 1. Console Mode (Development) ---
        if not self.is_live:
            # Use logger instead of print to ensure it appears in Celery logs
            logger.info(f"📨 [SMS MOCK] To: {recipient} | Body: {message}")
            return True
        
        # --- 2. Live Mode (Production) ---
        if not (self.api_key and self.sender_id):
            logger.error(f"❌ Cannot send SMS to {recipient}: Missing API Credentials.")
            return False

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "message": message,
            "sender": self.sender_id,
            "receivers": [recipient],
        }

        try:
            response = requests.post(self.API_URL, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            logger.info(f"✅ SMS dispatched to {recipient}. Resp: {response.status_code}")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ SMS Failed to {recipient}: {e}")
            return False
        
        except Exception as e:
            logger.error(f"❌ SMS Unexpected Error: {e}")
            return False

# Singleton instance
sms_service = SMSService()