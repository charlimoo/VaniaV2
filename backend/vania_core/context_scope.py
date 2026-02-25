import copy
from django.utils import timezone
from users.models import UserContextEntry
from users.services import user_context_manager


def build_scoped_key(base_key: str, doctor_id) -> str:
    return f"{base_key}__doctor_{doctor_id}"


def migrate_legacy_to_scoped_once(patient, doctor_id, base_key: str, default_factory):
    """
    Ensures a doctor-scoped singleton entry exists for a patient and base key.
    If scoped entry is missing and a legacy entry exists, copies legacy data once.
    """
    scoped_key = build_scoped_key(base_key, doctor_id)
    scoped_entry = user_context_manager.get_context(patient, scoped_key)
    if scoped_entry:
        return scoped_entry

    legacy_entry = user_context_manager.get_context(patient, base_key)
    if legacy_entry:
        migrated_data = copy.deepcopy(legacy_entry.data) if isinstance(legacy_entry.data, dict) else {}
        migrated_data["_scope_migration"] = {
            "from_key": base_key,
            "to_key": scoped_key,
            "migrated_at": timezone.now().isoformat(),
            "doctor_id": int(doctor_id),
        }
        return user_context_manager.set_singleton_context(
            user=patient,
            key=scoped_key,
            data=migrated_data,
            source=UserContextEntry.SourceType.SYSTEM,
        )

    return user_context_manager.set_singleton_context(
        user=patient,
        key=scoped_key,
        data=default_factory(),
        source=UserContextEntry.SourceType.SYSTEM,
    )
