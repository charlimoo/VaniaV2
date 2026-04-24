from rest_framework.throttling import SimpleRateThrottle


class ScopedPhoneRateThrottle(SimpleRateThrottle):
    scope = "auth"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        phone_number = ""
        if hasattr(request, "data"):
            phone_number = str(request.data.get("phone_number") or "").strip()
        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{ident}:{phone_number or 'unknown'}",
        }


class RequestOTPThrottle(ScopedPhoneRateThrottle):
    scope = "request_otp"


class VerifyOTPThrottle(ScopedPhoneRateThrottle):
    scope = "verify_otp"


class PasswordLoginThrottle(ScopedPhoneRateThrottle):
    scope = "password_login"
