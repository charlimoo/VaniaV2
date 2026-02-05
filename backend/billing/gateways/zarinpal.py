import requests
import logging
from django.conf import settings
from .base import PaymentGatewayBase
from typing import Tuple, Optional
logger = logging.getLogger(__name__)

class ZarinPalGateway(PaymentGatewayBase):
    """
    Implementation for ZarinPal (V4 REST API).
    Handles conversion between System Currency (Toman) and Gateway Currency (Rials).
    """
    
    # Production URLs
    ZP_API_REQUEST = "https://api.zarinpal.com/pg/v4/payment/request.json"
    ZP_API_VERIFY = "https://api.zarinpal.com/pg/v4/payment/verify.json"
    ZP_API_STARTPAY = "https://www.zarinpal.com/pg/StartPay/"

    # Sandbox URLs
    SANDBOX_API_REQUEST = "https://sandbox.zarinpal.com/pg/v4/payment/request.json"
    SANDBOX_API_VERIFY = "https://sandbox.zarinpal.com/pg/v4/payment/verify.json"
    SANDBOX_API_STARTPAY = "https://sandbox.zarinpal.com/pg/StartPay/"

    def __init__(self):
        self.merchant_id = getattr(settings, 'ZARINPAL_MERCHANT_ID', None)
        # Use Sandbox if explicitly requested or if DEBUG is True and no Merchant ID is provided
        self.sandbox = getattr(settings, 'ZARINPAL_SANDBOX', settings.DEBUG)
        
        if self.sandbox:
            self.ZP_API_REQUEST = self.SANDBOX_API_REQUEST
            self.ZP_API_VERIFY = self.SANDBOX_API_VERIFY
            self.ZP_API_STARTPAY = self.SANDBOX_API_STARTPAY
            # Default mock Merchant ID for Sandbox
            if not self.merchant_id:
                self.merchant_id = "00000000-0000-0000-0000-000000000000"

    def request_payment(self, invoice, callback_url: str) -> dict:
        """
        Initiates a payment request to ZarinPal.
        """
        if not self.merchant_id:
            raise ValueError("ZarinPal Merchant ID is not configured in settings.")

        # Convert Toman to Rials (x10)
        amount_rials = int(invoice.total_amount * 10)
        
        # User Identifier (Mobile or Email)
        metadata = {}
        if invoice.user.phone_number:
            metadata["mobile"] = invoice.user.phone_number
        if invoice.user.email:
            metadata["email"] = invoice.user.email

        description = f"Payment for Invoice #{invoice.id}"

        data = {
            "merchant_id": self.merchant_id,
            "amount": amount_rials,
            "currency": "IRR",
            "description": description,
            "callback_url": callback_url,
            "metadata": metadata
        }

        try:
            response = requests.post(self.ZP_API_REQUEST, json=data, timeout=15)
            response.raise_for_status()
            res_data = response.json()
            
            # Check ZarinPal Status Code (100 means success)
            if res_data.get("data", {}).get("code") == 100:
                authority = res_data["data"]["authority"]
                return {
                    "url": f"{self.ZP_API_STARTPAY}{authority}",
                    "authority": authority
                }
            else:
                errors = res_data.get("errors", {})
                logger.error(f"ZarinPal Request Failed. Code: {res_data.get('data', {}).get('code')} | Errors: {errors}")
                raise Exception(f"Gateway Error: {errors}")

        except requests.exceptions.RequestException as e:
            logger.error(f"ZarinPal Connection Error: {e}")
            raise Exception("Could not connect to payment gateway.")

    def verify_payment(self, authority: str, amount_toman: int) -> Tuple[bool, Optional[str]]:
        """
        Verifies a payment after callback.
        """
        amount_rials = int(amount_toman * 10)
        
        data = {
            "merchant_id": self.merchant_id,
            "amount": amount_rials,
            "authority": authority
        }

        try:
            response = requests.post(self.ZP_API_VERIFY, json=data, timeout=15)
            response.raise_for_status()
            res_data = response.json()
            
            status_code = res_data.get("data", {}).get("code")
            
            # 100: Success
            # 101: Verified (Already verified)
            if status_code in [100, 101]:
                ref_id = res_data["data"].get("ref_id", "N/A")
                return True, str(ref_id)
            
            logger.warning(f"Payment Verification Failed. Status: {status_code} | Msg: {res_data.get('data', {}).get('message')}")
            return False, None

        except Exception as e:
            logger.error(f"ZarinPal Verification Exception: {e}")
            return False, None