const PERSIAN_AND_ARABIC_DIGIT_MAP: Record<string, string> = {
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
};

export const IRAN_MOBILE_REGEX = /^09\d{9}$/;

export function toLatinDigits(value: string): string {
  return (value || "").replace(/[۰-۹٠-٩]/g, (digit) => PERSIAN_AND_ARABIC_DIGIT_MAP[digit] || digit);
}

export function normalizePhoneNumberInput(value: string): string {
  return toLatinDigits(value).replace(/\D/g, "");
}

export function sanitizePhoneInputForDisplay(value: string): string {
  return normalizePhoneNumberInput(value).slice(0, 11);
}

export function isValidIranMobile(value: string): boolean {
  return IRAN_MOBILE_REGEX.test(normalizePhoneNumberInput(value));
}

export function getNormalizedValidPhoneOrNull(value: string): string | null {
  const normalized = normalizePhoneNumberInput(value);
  return IRAN_MOBILE_REGEX.test(normalized) ? normalized : null;
}
