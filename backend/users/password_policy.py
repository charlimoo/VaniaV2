from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils.encoding import force_str


PASSWORD_ERROR_MESSAGES = {
    "password_too_short": "رمز عبور باید حداقل ۸ کاراکتر باشد.",
    "password_too_common": "رمز عبور انتخابی خیلی رایج است. لطفاً یک رمز عبور متفاوت انتخاب کنید.",
    "password_entirely_numeric": "رمز عبور نباید فقط عدد باشد.",
    "password_too_similar": "رمز عبور نباید شبیه اطلاعات حساب شما باشد.",
    "password_missing_letter": "رمز عبور باید شامل حداقل یک حرف باشد.",
    "password_missing_digit": "رمز عبور باید شامل حداقل یک عدد باشد.",
    "password_missing_symbol": "رمز عبور باید شامل حداقل یک نشانه مانند !، @ یا # باشد.",
}


def translate_password_validation_error(error):
    code = getattr(error, "code", None)
    if code in PASSWORD_ERROR_MESSAGES:
        return PASSWORD_ERROR_MESSAGES[code]

    message = getattr(error, "message", None)
    if message:
        return force_str(message)

    return force_str(error)


def validate_password_policy(password, user=None):
    try:
        validate_password(password, user=user)
    except ValidationError as exc:
        messages = []
        seen = set()

        for error in exc.error_list:
            translated = translate_password_validation_error(error)
            if translated not in seen:
                messages.append(translated)
                seen.add(translated)

        raise ValidationError(messages)
