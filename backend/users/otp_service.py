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
    SEND_COOLDOWN_SECONDS = 60

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
        cooldown_key = f"{self._get_cache_key(phone_number)}_cooldown"
        if cache.get(cooldown_key):
            raise ValueError("OTP request is cooling down.")
        otp = self._generate_otp()
        cache_key = self._get_cache_key(phone_number)

        cache.set(cache_key, otp, self.OTP_EXPIRY_SECONDS)
        cache.set(cooldown_key, True, self.SEND_COOLDOWN_SECONDS)

        if getattr(settings, 'USE_CELERY', False):
            send_sms_otp.delay(phone_number, otp)
        else:
            send_sms_otp(phone_number, otp)

    def verify_otp(self, phone_number: str, otp_code: str) -> bool:
        """
        Verifies if the provided OTP code is correct for the given phone number.
        Returns True if valid, False otherwise.
        """
        cache_key = self._get_cache_key(phone_number)
        stored_otp = cache.get(cache_key)

        if stored_otp and str(stored_otp) == str(otp_code):
            # The OTP is correct. Prevent reuse.
            cache.delete(cache_key)
            return True
        
        return False

# Instantiate a singleton of the service
otp_service = OTPService()
