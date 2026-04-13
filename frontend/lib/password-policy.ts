export const PASSWORD_MIN_LENGTH = 8

export const PASSWORD_POLICY_HINT =
  "رمز عبور باید حداقل ۸ کاراکتر باشد و شامل حروف، عدد و یک نشانه مانند ! یا @ باشد."

const LETTER_REGEX = /\p{L}/u
const DIGIT_REGEX = /\p{N}/u
const SYMBOL_REGEX = /[^\p{L}\p{N}\s]/u

export function getPasswordPolicyErrors(password: string): string[] {
  const errors: string[] = []

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`رمز عبور باید حداقل ${PASSWORD_MIN_LENGTH} کاراکتر باشد.`)
  }

  if (!LETTER_REGEX.test(password)) {
    errors.push("رمز عبور باید شامل حداقل یک حرف باشد.")
  }

  if (!DIGIT_REGEX.test(password)) {
    errors.push("رمز عبور باید شامل حداقل یک عدد باشد.")
  }

  if (!SYMBOL_REGEX.test(password)) {
    errors.push("رمز عبور باید شامل حداقل یک نشانه مانند !، @ یا # باشد.")
  }

  return errors
}

export function isStrongPassword(password: string): boolean {
  return getPasswordPolicyErrors(password).length === 0
}
