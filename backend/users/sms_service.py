import json
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class SMSError(Exception):
    pass


class SMSTransientError(SMSError):
    pass


class SMSPermanentError(SMSError):
    pass


class SMSService:
    SMSIR_API_URL = "https://api.sms.ir/v1/send/verify"
    NAJVA_API_URL = "https://sms.najva.com/v2/sms/send"

    def __init__(self):
        self.mode = getattr(settings, "SMS_SERVICE_MODE", "CONSOLE").upper()
        self.smsir_api_key = getattr(settings, "SMSIR_API_KEY", None)
        self.smsir_template_id = getattr(settings, "SMSIR_TEMPLATE_ID", 100000)
        self.smsir_param_name = getattr(settings, "SMSIR_PARAMETER_NAME", "Code")

        self.najva_api_key = getattr(settings, "NAJVA_API_KEY", None)
        self.najva_sender_id = getattr(settings, "NAJVA_SENDER_ID", None)

    def send_otp(self, recipient: str, code: str) -> bool:
        if self.mode != "LIVE":
            logger.info("📨 [SMS MOCK - OTP] To: %s | Code: %s", recipient, code)
            return True

        if not self.smsir_api_key:
            raise SMSPermanentError("SMS.ir API key is missing.")

        headers = {
            "Content-Type": "application/json",
            "Accept": "text/plain",
            "x-api-key": self.smsir_api_key,
        }
        payload = {
            "mobile": recipient,
            "templateId": int(self.smsir_template_id),
            "parameters": [
                {
                    "name": self.smsir_param_name,
                    "value": str(code),
                }
            ],
        }
        return self._post_request(self.SMSIR_API_URL, headers, payload, "SMSIR")

    def send_message(self, recipient: str, message: str) -> bool:
        if self.mode != "LIVE":
            logger.info("📨 [SMS MOCK - Generic] To: %s | Msg: %s", recipient, message)
            return True

        if not (self.najva_api_key and self.najva_sender_id):
            raise SMSPermanentError("Najva credentials are missing.")

        headers = {
            "Authorization": f"Bearer {self.najva_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "message": message,
            "sender": self.najva_sender_id,
            "receivers": [recipient],
        }
        return self._post_request(self.NAJVA_API_URL, headers, payload, "NAJVA")

    def _post_request(self, url: str, headers: dict, payload: dict, provider_name: str) -> bool:
        logger.info("🚀 [%s] Sending Request to %s", provider_name, url)
        logger.info("   Payload: %s", json.dumps(payload, ensure_ascii=False))

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
            logger.error("❌ [%s] Transport Exception: %s", provider_name, exc)
            raise SMSTransientError(str(exc)) from exc
        except requests.exceptions.RequestException as exc:
            logger.error("❌ [%s] Request Exception: %s", provider_name, exc)
            raise SMSTransientError(str(exc)) from exc

        if response.status_code >= 500:
            logger.error("❌ [%s] HTTP %s: %s", provider_name, response.status_code, response.text)
            raise SMSTransientError(f"{provider_name} server error {response.status_code}")
        if response.status_code >= 400:
            logger.error("❌ [%s] HTTP %s: %s", provider_name, response.status_code, response.text)
            raise SMSPermanentError(f"{provider_name} rejected the request with HTTP {response.status_code}")

        response_data = response.json()
        if provider_name == "SMSIR" and response_data.get("status") != 1:
            message = response_data.get("message") or "Unknown provider error"
            logger.error("❌ [%s] API Error: %s", provider_name, message)
            raise SMSPermanentError(message)

        logger.info("✅ [%s] Success.", provider_name)
        return True


sms_service = SMSService()
