import re
from django.core.exceptions import ValidationError

PHONE_NUMBER_PATTERN = re.compile(r"^09\d{9}$")

_DIGIT_TRANSLATION = str.maketrans({
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
})


def normalize_phone_number(raw_phone: str) -> str:
    value = str(raw_phone or "").translate(_DIGIT_TRANSLATION).strip()
    return re.sub(r"\D", "", value)


def is_valid_phone_number(phone_number: str) -> bool:
    return bool(PHONE_NUMBER_PATTERN.fullmatch(phone_number or ""))


def normalize_and_validate_phone_number(raw_phone: str) -> str:
    normalized = normalize_phone_number(raw_phone)
    if not is_valid_phone_number(normalized):
        raise ValidationError("شماره موبایل باید ۱۱ رقم و با فرمت 09123456789 باشد.")
    return normalized
