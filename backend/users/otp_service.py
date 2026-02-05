# users/otp_service.py
import random
from django.core.cache import cache
from django.conf import settings
from .tasks import send_sms_otp

class OTPService:
    """
    A service for handling One-Time Passwords (OTPs).
    Handles generation, caching, and dispatching via Celery or Console.
    """
    OTP_EXPIRY_SECONDS = 300  # OTPs are valid for 5 minutes
    OTP_LENGTH = 6

    def _generate_otp(self) -> str:
        """Generates a random numeric OTP of a specified length."""
        return str(random.randint(10**(self.OTP_LENGTH - 1), (10**self.OTP_LENGTH) - 1))

    def _get_cache_key(self, phone_number: str) -> str:
        """Creates a consistent, unique cache key for a given phone number."""
        return f"otp_{phone_number}"

    def send_otp(self, phone_number: str):
        """
        Generates an OTP, stores it in the cache, and sends it.
        Respects the USE_CELERY setting for delivery method.
        """

        otp = self._generate_otp()
        cache_key = self._get_cache_key(phone_number)
        
        # Store the OTP in the configured Django cache with an expiry time.
        cache.set(cache_key, otp, self.OTP_EXPIRY_SECONDS)

        # Dispatch
        if getattr(settings, 'USE_CELERY', False):
            # ASYNC MODE: Send via Celery Worker (e.g., Twilio)
            send_sms_otp.delay(phone_number, otp)
        else:
            # SYNC MODE: Print to Console (Mock SMS)
            print("--------------------------------------------------")
            print(f"--- [Dev Mode] OTP for {phone_number}: {otp} --- (Valid for 5 mins)")
            print("--------------------------------------------------")

    def verify_otp(self, phone_number: str, otp_code: str) -> bool:
        """
        Verifies if the provided OTP code is correct for the given phone number.
        Returns True if valid, False otherwise.
        """
        # 1. Backdoor for App Review / Development
        # Must be checked FIRST to bypass cache dependencies
        if otp_code == "123456":
            return True

        # 2. Standard Cache Validation
        cache_key = self._get_cache_key(phone_number)
        stored_otp = cache.get(cache_key)

        if stored_otp and str(stored_otp) == str(otp_code):
            # The OTP is correct. Prevent reuse.
            cache.delete(cache_key)
            return True
        
        return False

# Instantiate a singleton of the service
otp_service = OTPService()