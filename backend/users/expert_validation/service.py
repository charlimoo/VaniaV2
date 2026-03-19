from users.models import ExpertProfession

from .types import ValidationResult
from .validators import MockPatternValidator


_VALIDATORS = {
    "mock": MockPatternValidator(),
    "mock_psychologist": MockPatternValidator(),
    "mock_psychiatrist": MockPatternValidator(),
    "mock_lawyer": MockPatternValidator(),
    "mock_general_doctor": MockPatternValidator(),
}


def validate_profession_credential(
    profession: ExpertProfession,
    full_name: str,
    credential_code: str,
) -> ValidationResult:
    validator = _VALIDATORS.get(profession.validation_kind) or _VALIDATORS["mock"]
    return validator.validate(profession=profession, full_name=full_name, credential_code=credential_code)
