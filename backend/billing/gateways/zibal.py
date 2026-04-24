import logging

import requests
from django.conf import settings

from .base import PaymentGatewayBase

logger = logging.getLogger(__name__)


class ZibalGateway(PaymentGatewayBase):
    API_REQUEST_URL = "https://gateway.zibal.ir/v1/request"
    API_VERIFY_URL = "https://gateway.zibal.ir/v1/verify"
    API_START_URL = "https://gateway.zibal.ir/start/"

    def __init__(self):
        self.merchant_id = getattr(settings, "ZIBAL_MERCHANT_ID", "zibal")

    def request_payment(self, invoice, callback_url: str) -> dict:
        amount_rials = int(invoice.total_amount * 10)
        mobile = invoice.user.phone_number if invoice.user and invoice.user.phone_number else ""
        payload = {
            "merchant": self.merchant_id,
            "amount": amount_rials,
            "callbackUrl": callback_url,
            "description": f"Payment for Invoice #{invoice.id}",
            "orderId": str(invoice.id),
            "mobile": mobile,
        }
        try:
            response = requests.post(self.API_REQUEST_URL, json=payload, timeout=15)
            response.raise_for_status()
            data = response.json()
            if data.get("result") == 100:
                track_id = str(data["trackId"])
                return {
                    "url": f"{self.API_START_URL}{track_id}",
                    "authority": track_id,
                }
            logger.error("Zibal request failed: %s", data)
            raise Exception(data.get("message") or "Zibal request failed")
        except requests.exceptions.RequestException as exc:
            logger.error("Zibal connection error: %s", exc)
            raise Exception("Could not connect to Zibal payment gateway.") from exc

    def verify_payment(self, authority: str, amount_toman: int) -> dict:
        payload = {
            "merchant": self.merchant_id,
            "trackId": authority,
        }
        amount_rials = int(amount_toman * 10)
        try:
            response = requests.post(self.API_VERIFY_URL, json=payload, timeout=15)
            response.raise_for_status()
            data = response.json()
            result_code = data.get("result")
            if result_code in [100, 201]:
                paid_amount = int(data.get("amount") or 0)
                if paid_amount != amount_rials:
                    logger.critical("Zibal amount mismatch for %s: expected %s, got %s", authority, amount_rials, paid_amount)
                    return {"success": False}
                return {
                    "success": True,
                    "ref_number": str(data.get("refNumber") or "N/A"),
                    "card_number": str(data.get("cardNumber")) if data.get("cardNumber") else None,
                }
            logger.warning("Zibal verification failed: %s", data)
            return {"success": False}
        except requests.exceptions.RequestException as exc:
            logger.error("Zibal verification exception: %s", exc)
            return {"success": False}
