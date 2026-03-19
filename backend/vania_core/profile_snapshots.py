from typing import Any, Dict, List, Optional

from users.roles import is_expert

from .case_service import CaseService
from .models import DoctorProfile


def get_expert_profile_payload(user: Any) -> Optional[Dict[str, Any]]:
    if not is_expert(user):
        return None

    try:
        profile = user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return None

    profession = getattr(user, "expert_profession", None)
    location = getattr(profile, "location", None)
    meeting_price = getattr(profile, "meeting_price", None)

    return {
        "user_id": int(user.id),
        "full_name": user.full_name or user.phone_number,
        "phone_number": user.phone_number,
        "email": getattr(user, "email", "") or "",
        "expert_profession_slug": getattr(profession, "slug", None),
        "expert_profession_label": getattr(profession, "name", None),
        "specialty": profile.specialty or "",
        "bio": profile.bio or "",
        "clinic_address": profile.clinic_address or "",
        "location_name": getattr(location, "name", "") if location else "",
        "meeting_price": int(meeting_price) if meeting_price and meeting_price > 0 else 0,
        "accepting_new_patients": bool(profile.accepting_new_patients),
        "is_public": bool(profile.is_public),
        "avatar_url": profile.avatar.url if profile.avatar and hasattr(profile.avatar, "url") else None,
    }


def format_expert_profile_context(user: Any) -> List[str]:
    payload = get_expert_profile_payload(user)
    if not payload:
        return []

    lines: List[str] = []
    if payload.get("expert_profession_label"):
        lines.append(f"Expert Profession: {payload['expert_profession_label']}")
    if payload.get("specialty"):
        lines.append(f"Specialty: {payload['specialty']}")
    if payload.get("bio"):
        lines.append(f"Bio: {payload['bio']}")
    if payload.get("clinic_address"):
        lines.append(f"Clinic Address: {payload['clinic_address']}")
    if payload.get("location_name"):
        lines.append(f"Location: {payload['location_name']}")
    if payload.get("meeting_price"):
        lines.append(f"Meeting Price (Toman): {payload['meeting_price']}")
    lines.append(f"Accepting New Patients: {'Yes' if payload['accepting_new_patients'] else 'No'}")
    lines.append(f"Listed Publicly: {'Yes' if payload['is_public'] else 'No'}")
    return [f"Expert Profile - {line}" for line in lines]


def get_visitor_base_profile_payload(user: Any) -> Dict[str, Any]:
    entry = CaseService.get_latest_base_profile_entry(user)
    data = entry.data if entry and isinstance(entry.data, dict) else {}
    return {
        **data,
        "user_id": int(user.id),
        "full_name": data.get("full_name") or user.full_name or user.phone_number,
        "phone_number": user.phone_number,
        "email": data.get("email") or getattr(user, "email", "") or "",
    }


def format_visitor_profile_context(user: Any) -> List[str]:
    data = get_visitor_base_profile_payload(user)
    lines: List[str] = [
        f"Visitor Name: {data.get('full_name') or user.phone_number}",
        f"Visitor Phone: {data.get('phone_number') or user.phone_number}",
    ]
    if data.get("birth_date"):
        lines.append(f"Birth Date: {data['birth_date']}")
    if data.get("education_level"):
        lines.append(f"Education: {data['education_level']}")
    if data.get("job_status") or data.get("job_title"):
        lines.append(f"Job: {(data.get('job_status') or '').strip()} {(data.get('job_title') or '').strip()}".strip())
    if data.get("marital_status"):
        lines.append(f"Marital Status: {data['marital_status']}")
    if data.get("preferred_contact_method"):
        lines.append(f"Preferred Contact: {data['preferred_contact_method']}")
    return [f"Visitor Profile - {line}" for line in lines if line.split(': ', 1)[-1]]
