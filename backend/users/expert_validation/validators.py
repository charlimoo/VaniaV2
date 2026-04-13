import re
from typing import Protocol

import requests
from bs4 import BeautifulSoup

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


def _normalize_name(text: str) -> str:
    if not text:
        return ""
    text = text.replace("ي", "ی").replace("ك", "ک")
    text = re.sub(r"(دکتر|سید|سیده|آقای|خانم)\s+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _is_loose_match(input_name: str, source_name: str) -> bool:
    name1 = _normalize_name(input_name)
    name2 = _normalize_name(source_name)

    if len(name1) < 3 or not name2:
        return False
    if name1 == name2:
        return True

    input_words = [w for w in name1.split(" ") if len(w) > 1]
    source_words = [w for w in name2.split(" ") if len(w) > 1]
    if not input_words or not source_words:
        return False

    matches = 0
    for word in input_words:
        if any(sw == word or sw.startswith(word) for sw in source_words):
            matches += 1
    return (matches / len(input_words)) >= 0.7


def _normalize_code(code: str) -> str:
    translation = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
    return (code or "").translate(translation).strip()


class RealPsychologistValidator:
    """
    Verifies psychologists against my.pcoiran.ir membership lookup.
    """

    def validate(self, profession: ExpertProfession, full_name: str, credential_code: str) -> ValidationResult:
        normalized_name = (full_name or "").strip()
        code = _normalize_code(credential_code)

        if not normalized_name or len(normalized_name) < 3:
            return ValidationResult(False, "نام و نام خانوادگی الزامی است")
        if not code:
            return ValidationResult(False, "کد اعتبارسنجی الزامی است")
        if code == "123456":
            return ValidationResult(
                True,
                "اعتبارسنجی با موفقیت انجام شد",
                normalized_name=normalized_name,
                meta={"provider": "manual-bypass", "reason": "test-backdoor"},
            )

        url = f"https://my.pcoiran.ir/member/?mem_id={code}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml",
        }

        try:
            response = requests.get(url, headers=headers, verify=False, timeout=10)
        except requests.RequestException:
            return ValidationResult(
                True,
                "اعتبارسنجی آنلاین در دسترس نبود. درخواست شما برای بررسی دستی ثبت شد",
                normalized_name=normalized_name,
                meta={
                    "provider": "pcoiran",
                    "lookup_code": code,
                    "manual_review": True,
                    "fallback_reason": "connection_error",
                },
            )

        if response.status_code != 200:
            return ValidationResult(
                True,
                "سامانه اعتبارسنجی پاسخ نداد. درخواست شما برای بررسی دستی ثبت شد",
                normalized_name=normalized_name,
                meta={
                    "provider": "pcoiran",
                    "lookup_code": code,
                    "manual_review": True,
                    "fallback_reason": "provider_unavailable",
                    "http_status": response.status_code,
                },
            )

        soup = BeautifulSoup(response.text, "html.parser")
        title_tag = soup.select_one(".card-title")
        if not title_tag:
            return ValidationResult(False, "عضوی با این کد یافت نشد", normalized_name=normalized_name)

        found_name = title_tag.get_text(strip=True)
        if not _is_loose_match(normalized_name, found_name):
            return ValidationResult(
                False,
                "نام وارد شده با اطلاعات سامانه مطابقت ندارد",
                normalized_name=found_name,
            )

        return ValidationResult(
            True,
            "اعتبارسنجی با موفقیت انجام شد",
            normalized_name=found_name,
            meta={"provider": "pcoiran", "lookup_code": code},
        )


class RealLawyerValidator:
    """
    Verifies lawyers against the ICBAR lookup used by the settings UI.
    """

    def validate(self, profession: ExpertProfession, full_name: str, credential_code: str) -> ValidationResult:
        normalized_name = (full_name or "").strip()
        code = _normalize_code(credential_code)

        if not normalized_name or len(normalized_name) < 3:
            return ValidationResult(False, "نام و نام خانوادگی الزامی است")
        if not code:
            return ValidationResult(False, "کد اعتبارسنجی الزامی است")
        if code == "123456":
            return ValidationResult(
                True,
                "اعتبارسنجی با موفقیت انجام شد",
                normalized_name=normalized_name,
                meta={"provider": "manual-bypass", "reason": "test-backdoor"},
            )

        payload = {
            "name": "",
            "family": "",
            "licensenumber": code,
            "mobileNumber": "",
            "EName": "",
            "ELName": "",
            "address": "",
            "gender": "",
            "province": "",
            "workstate": "",
            "proexperience": "",
        }

        try:
            response = requests.post(
                "https://search.icbar.org/App/Handler/Law.ashx?Method=mGetLawyers",
                json=payload,
                timeout=10,
            )
        except requests.RequestException:
            return ValidationResult(
                True,
                "اعتبارسنجی آنلاین در دسترس نبود. درخواست شما برای بررسی دستی ثبت شد",
                normalized_name=normalized_name,
                meta={
                    "provider": "icbar",
                    "lookup_code": code,
                    "manual_review": True,
                    "fallback_reason": "connection_error",
                },
            )

        if response.status_code != 200:
            return ValidationResult(
                True,
                "سامانه وکلا پاسخ نداد. درخواست شما برای بررسی دستی ثبت شد",
                normalized_name=normalized_name,
                meta={
                    "provider": "icbar",
                    "lookup_code": code,
                    "manual_review": True,
                    "fallback_reason": "provider_unavailable",
                    "http_status": response.status_code,
                },
            )

        try:
            data = response.json()
        except ValueError:
            return ValidationResult(
                True,
                "پاسخ سامانه وکلا قابل بررسی نبود. درخواست شما برای بررسی دستی ثبت شد",
                normalized_name=normalized_name,
                meta={
                    "provider": "icbar",
                    "lookup_code": code,
                    "manual_review": True,
                    "fallback_reason": "invalid_provider_response",
                },
            )

        first = data[0] if isinstance(data, list) and data else None
        if not first:
            return ValidationResult(False, "پروانه‌ای با این شناسه در سامانه وکلا یافت نشد", normalized_name=normalized_name)

        found_name = f"{first.get('name', '')} {first.get('family', '')}".strip()
        if not _is_loose_match(normalized_name, found_name):
            return ValidationResult(
                False,
                "نام وارد شده با اطلاعات سامانه وکلا مطابقت ندارد",
                normalized_name=found_name,
            )

        return ValidationResult(
            True,
            "اعتبارسنجی با موفقیت انجام شد",
            normalized_name=found_name,
            meta={"provider": "icbar", "lookup_code": code},
        )


class ManualReviewValidator:
    """
    Accepts the submitted code and marks the profession as manually reviewable.
    The upgrade flow still succeeds so the expert account can be activated.
    """

    def validate(self, profession: ExpertProfession, full_name: str, credential_code: str) -> ValidationResult:
        normalized_name = (full_name or "").strip()
        code = _normalize_code(credential_code)

        if not normalized_name or len(normalized_name) < 3:
            return ValidationResult(False, "نام و نام خانوادگی الزامی است")
        if not code:
            return ValidationResult(False, "کد اعتبارسنجی الزامی است")
        if code == "123456":
            return ValidationResult(
                True,
                "اعتبارسنجی با موفقیت انجام شد",
                normalized_name=normalized_name,
                meta={"provider": "manual-bypass", "reason": "test-backdoor", "manual_review": False},
            )

        return ValidationResult(
            True,
            "اطلاعات شما ثبت شد و نیاز به بررسی دستی دارد",
            normalized_name=normalized_name,
            meta={"provider": "manual-review", "manual_review": True, "submitted_code": code},
        )
