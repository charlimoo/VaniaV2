from typing import Protocol

from users.models import ExpertProfession

from .types import ValidationResult


class ExpertCredentialValidator(Protocol):
    def validate(self, profession: ExpertProfession, full_name: str, credential_code: str) -> ValidationResult:
        ...


class MockPatternValidator:
    """
    Simple mock validator. Supports:
    - universal test code: 123456
    - prefix match via validation_config.required_prefix
    - explicit allow list via validation_config.accepted_codes
    """

    def validate(self, profession: ExpertProfession, full_name: str, credential_code: str) -> ValidationResult:
        if not full_name or len(full_name.strip()) < 3:
            return ValidationResult(False, "نام و نام خانوادگی الزامی است")
        if not credential_code:
            return ValidationResult(False, "کد اعتبارسنجی الزامی است")

        normalized_name = full_name.strip()
        code = str(credential_code).strip()
        cfg = profession.validation_config or {}

        if code == "123456":
            return ValidationResult(
                True,
                "اعتبارسنجی با موفقیت انجام شد",
                normalized_name=normalized_name,
                meta={"provider": "mock", "reason": "test-backdoor"},
            )

        accepted_codes = [str(c).strip().upper() for c in cfg.get("accepted_codes", []) if c]
        if accepted_codes and code.upper() in accepted_codes:
            return ValidationResult(
                True,
                "اعتبارسنجی با موفقیت انجام شد",
                normalized_name=normalized_name,
                meta={"provider": "mock", "reason": "allow-list"},
            )

        required_prefix = str(cfg.get("required_prefix", "")).strip().upper()
        if required_prefix and code.upper().startswith(required_prefix):
            return ValidationResult(
                True,
                "اعتبارسنجی با موفقیت انجام شد",
                normalized_name=normalized_name,
                meta={"provider": "mock", "reason": "prefix-match", "prefix": required_prefix},
            )

        return ValidationResult(False, "کد وارد شده برای این حوزه معتبر نیست", normalized_name=normalized_name)
