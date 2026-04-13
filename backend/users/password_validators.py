from django.core.exceptions import ValidationError


class StrongPasswordValidator:
    """
    Enforces a stronger baseline password policy for public account creation
    and password changes.
    """

    min_length = 8

    def validate(self, password, user=None):
        errors = []

        if len(password) < self.min_length:
            errors.append(
                ValidationError(
                    "رمز عبور باید حداقل ۸ کاراکتر باشد.",
                    code="password_too_short",
                )
            )

        if not any(char.isalpha() for char in password):
            errors.append(
                ValidationError(
                    "رمز عبور باید شامل حداقل یک حرف باشد.",
                    code="password_missing_letter",
                )
            )

        if not any(char.isdigit() for char in password):
            errors.append(
                ValidationError(
                    "رمز عبور باید شامل حداقل یک عدد باشد.",
                    code="password_missing_digit",
                )
            )

        if not any(not char.isalnum() and not char.isspace() for char in password):
            errors.append(
                ValidationError(
                    "رمز عبور باید شامل حداقل یک نشانه مانند !، @ یا # باشد.",
                    code="password_missing_symbol",
                )
            )

        if errors:
            raise ValidationError([error.message for error in errors])

    def get_help_text(self):
        return "رمز عبور باید حداقل ۸ کاراکتر باشد و شامل حروف، عدد و یک نشانه باشد."
