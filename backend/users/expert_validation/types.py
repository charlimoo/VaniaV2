from dataclasses import dataclass, field
from typing import Dict, Any


@dataclass
class ValidationResult:
    verified: bool
    message: str
    normalized_name: str | None = None
    meta: Dict[str, Any] = field(default_factory=dict)
