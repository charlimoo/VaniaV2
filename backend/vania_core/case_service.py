import copy
import re
import uuid
from typing import Any, Dict, List, Optional

from django.utils import timezone

from users.models import CustomUser, UserContextEntry
from users.services import user_context_manager
from vania_core.models import CaseAccessGrant, TreatmentConnection


def build_cases_key(doctor_id: int) -> str:
    return f"vania_cases__doctor_{doctor_id}"


def build_base_profile_key() -> str:
    return "vania_base_profile"


def build_case_scoped_key(base_key: str, doctor_id: int, case_id: str) -> str:
    compact_case_id = (case_id or "").replace("-", "")[:10]
    return f"{base_key}__d{doctor_id}__c{compact_case_id}"


class CaseService:
    CASES_CONTEXT_BASE = "vania_cases"
    BASE_PROFILE_CONTEXT_KEY = build_base_profile_key()
    LEGACY_GENERIC_CASE_TITLE_RE = re.compile(r"^پرونده\s+\d+\s*$")

    @staticmethod
    def _default_case_title(patient: CustomUser, doctor: CustomUser) -> str:
        patient_name = (
            CaseService.build_patient_profile(patient).get("name")
            or patient.full_name
            or patient.phone_number
            or "مراجع"
        )
        doctor_name = doctor.full_name or doctor.phone_number or "متخصص"
        return f"پرونده {doctor_name} - {patient_name}"

    @staticmethod
    def _normalize_legacy_case_titles(
        patient: CustomUser,
        doctor: CustomUser,
        cases: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        if not isinstance(cases, list):
            return []

        default_title = CaseService._default_case_title(patient, doctor)
        changed = False
        normalized_cases: List[Dict[str, Any]] = []

        for item in cases:
            if not isinstance(item, dict):
                normalized_cases.append(item)
                continue

            next_item = copy.deepcopy(item)
            current_title = str(next_item.get("title") or "").strip()
            if not current_title or CaseService.LEGACY_GENERIC_CASE_TITLE_RE.match(current_title):
                next_item["title"] = default_title
                changed = True
            normalized_cases.append(next_item)

        if changed:
            CaseService.save_cases(patient, int(doctor.id), normalized_cases, creator=doctor)

        return normalized_cases

    @staticmethod
    def _serialize_case(case_data: Dict[str, Any], doctor: Optional[CustomUser] = None) -> Dict[str, Any]:
        payload = copy.deepcopy(case_data)
        payload.setdefault("status", "OPEN")
        payload.setdefault("created_at", timezone.now().isoformat())
        payload.setdefault("updated_at", payload["created_at"])
        if doctor:
            payload.setdefault("doctor_id", int(doctor.id))
            payload.setdefault("doctor_name", doctor.full_name or doctor.phone_number)
            payload.setdefault("doctor_role_label", doctor.role.name if getattr(doctor, "role", None) else "متخصص")
            payload.setdefault("doctor_profession_slug", getattr(getattr(doctor, "expert_profession", None), "slug", None))
            payload.setdefault("doctor_profession_label", getattr(getattr(doctor, "expert_profession", None), "name", None))
        payload.setdefault("owner_doctor_id", payload.get("doctor_id"))
        payload.setdefault("owner_doctor_name", payload.get("doctor_name"))
        payload.setdefault("access_mode", "OWNER")
        payload.setdefault("can_edit", True)
        payload.setdefault("is_read_only", False)
        return payload

    @staticmethod
    def _active_connections_for_patient(patient: CustomUser):
        return TreatmentConnection.objects.filter(
            patient=patient,
            status=TreatmentConnection.Status.ACTIVE,
        ).select_related("doctor", "doctor__role", "doctor__expert_profession")

    @staticmethod
    def _serialize_grant(grant: CaseAccessGrant) -> Dict[str, Any]:
        grantee = grant.grantee_doctor
        return {
            "grantee_doctor_id": int(grantee.id),
            "grantee_doctor_name": grantee.full_name or grantee.phone_number,
            "grantee_doctor_role_label": grantee.role.name if getattr(grantee, "role", None) else "متخصص",
            "grantee_doctor_profession_slug": getattr(getattr(grantee, "expert_profession", None), "slug", None),
            "grantee_doctor_profession_label": getattr(getattr(grantee, "expert_profession", None), "name", None),
            "access_mode": grant.access_mode,
            "status": grant.status,
        }

    @staticmethod
    def _annotate_case_for_viewer(
        case_item: Dict[str, Any],
        *,
        patient: Optional[CustomUser],
        owner_doctor: CustomUser,
        viewer_doctor: Optional[CustomUser],
        can_edit: bool,
    ) -> Dict[str, Any]:
        payload = CaseService._serialize_case(case_item, doctor=owner_doctor)
        payload["owner_doctor_id"] = int(owner_doctor.id)
        payload["owner_doctor_name"] = owner_doctor.full_name or owner_doctor.phone_number
        payload["can_edit"] = can_edit
        payload["is_read_only"] = not can_edit
        payload["access_mode"] = "OWNER" if can_edit else "READ_ONLY"
        payload["shared_with"] = CaseService.get_case_shares(payload.get("id"), owner_doctor=owner_doctor, patient=patient)
        if viewer_doctor and not can_edit:
            payload["shared_to_doctor_id"] = int(viewer_doctor.id)
        return payload

    @staticmethod
    def get_cases(patient: CustomUser, doctor_id: int) -> List[Dict[str, Any]]:
        entry = user_context_manager.get_context(patient, build_cases_key(int(doctor_id)))
        if not entry or not isinstance(entry.data, dict):
            return []
        cases = entry.data.get("cases", [])
        if not isinstance(cases, list):
            return []
        doctor = CustomUser.objects.filter(pk=int(doctor_id)).first()
        if not doctor:
            return cases
        return CaseService._normalize_legacy_case_titles(patient, doctor, cases)

    @staticmethod
    def save_cases(patient: CustomUser, doctor_id: int, cases: List[Dict[str, Any]], creator=None):
        user_context_manager.set_singleton_context(
            user=patient,
            key=build_cases_key(int(doctor_id)),
            data={"cases": cases},
            source=UserContextEntry.SourceType.SYSTEM,
            creator=creator,
        )

    @staticmethod
    def create_case(
        patient: CustomUser,
        doctor: CustomUser,
        title: Optional[str] = None,
    ) -> Dict[str, Any]:
        doctor_id = int(doctor.id)
        cases = CaseService.get_cases(patient, doctor_id)
        timestamp = timezone.now().isoformat()
        case_payload = CaseService._serialize_case(
            {
                "id": uuid.uuid4().hex,
                "title": title or CaseService._default_case_title(patient, doctor),
                "created_at": timestamp,
                "updated_at": timestamp,
            },
            doctor=doctor,
        )
        cases.insert(0, case_payload)
        CaseService.save_cases(patient, doctor_id, cases, creator=doctor)
        return case_payload

    @staticmethod
    def touch_case(patient: CustomUser, doctor_id: int, case_id: str):
        cases = CaseService.get_cases(patient, doctor_id)
        changed = False
        for item in cases:
            if item.get("id") == case_id:
                item["updated_at"] = timezone.now().isoformat()
                changed = True
                break
        if changed:
            CaseService.save_cases(patient, doctor_id, cases)

    @staticmethod
    def rename_case(patient: CustomUser, doctor_id: int, case_id: str, title: str) -> Optional[Dict[str, Any]]:
        next_title = (title or "").strip()
        if not next_title:
            return None
        cases = CaseService.get_cases(patient, doctor_id)
        updated_case = None
        for item in cases:
            if item.get("id") == case_id:
                item["title"] = next_title
                item["updated_at"] = timezone.now().isoformat()
                updated_case = item
                break
        if updated_case:
            CaseService.save_cases(patient, doctor_id, cases)
        return updated_case

    @staticmethod
    def delete_case(patient: CustomUser, doctor_id: int, case_id: str) -> bool:
        cases = CaseService.get_cases(patient, doctor_id)
        remaining_cases = [item for item in cases if item.get("id") != case_id]
        if len(remaining_cases) == len(cases):
            return False
        CaseService.save_cases(patient, doctor_id, remaining_cases)
        return True

    @staticmethod
    def get_case(patient: CustomUser, doctor_id: int, case_id: Optional[str]) -> Optional[Dict[str, Any]]:
        if not case_id:
            return None
        for item in CaseService.get_cases(patient, doctor_id):
            if item.get("id") == case_id:
                return item
        return None

    @staticmethod
    def get_or_create_selected_case(
        patient: CustomUser,
        doctor: CustomUser,
        requested_case_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        doctor_id = int(doctor.id)
        existing = CaseService.get_case(patient, doctor_id, requested_case_id)
        if existing:
            return existing
        cases = CaseService.get_cases(patient, doctor_id)
        if cases:
            return cases[0]
        return CaseService.create_case(patient, doctor)

    @staticmethod
    def get_case_owner_connection(patient: CustomUser, case_id: str) -> Optional[TreatmentConnection]:
        if not case_id:
            return None
        for conn in CaseService._active_connections_for_patient(patient):
            if CaseService.get_case(patient, int(conn.doctor_id), case_id):
                return conn
        return None

    @staticmethod
    def get_case_shares(case_id: Optional[str], owner_doctor: Optional[CustomUser] = None, patient: Optional[CustomUser] = None) -> List[Dict[str, Any]]:
        if not case_id:
            return []
        qs = CaseAccessGrant.objects.filter(
            case_id=case_id,
            status=CaseAccessGrant.Status.ACTIVE,
        ).select_related("grantee_doctor", "grantee_doctor__role", "grantee_doctor__expert_profession")
        if owner_doctor is not None:
            qs = qs.filter(owner_doctor=owner_doctor)
        if patient is not None:
            qs = qs.filter(patient=patient)
        return [CaseService._serialize_grant(grant) for grant in qs]

    @staticmethod
    def get_share_candidates(patient: CustomUser, owner_doctor: CustomUser, case_id: str) -> List[Dict[str, Any]]:
        owner_profession_id = getattr(owner_doctor, "expert_profession_id", None)
        active_grantee_ids = set(
            CaseAccessGrant.objects.filter(
                patient=patient,
                owner_doctor=owner_doctor,
                case_id=case_id,
                status=CaseAccessGrant.Status.ACTIVE,
            ).values_list("grantee_doctor_id", flat=True)
        )
        candidates: List[Dict[str, Any]] = []
        for conn in CaseService._active_connections_for_patient(patient):
            doctor = conn.doctor
            if int(doctor.id) == int(owner_doctor.id):
                continue
            if doctor.id in active_grantee_ids:
                continue
            if owner_profession_id and doctor.expert_profession_id != owner_profession_id:
                continue
            candidates.append({
                "id": int(doctor.id),
                "name": doctor.full_name or doctor.phone_number,
                "role_label": doctor.role.name if getattr(doctor, "role", None) else "متخصص",
                "profession_slug": getattr(getattr(doctor, "expert_profession", None), "slug", None),
                "profession_label": getattr(getattr(doctor, "expert_profession", None), "name", None),
            })
        return candidates

    @staticmethod
    def get_case_share_options_for_patient(patient: CustomUser, case_id: str) -> Optional[Dict[str, Any]]:
        owner_conn = CaseService.get_case_owner_connection(patient, case_id)
        if not owner_conn:
            return None
        owner_doctor = owner_conn.doctor
        case_item = CaseService.get_case(patient, int(owner_doctor.id), case_id)
        if not case_item:
            return None
        return {
            "case": CaseService._annotate_case_for_viewer(
                case_item,
                patient=patient,
                owner_doctor=owner_doctor,
                viewer_doctor=None,
                can_edit=True,
            ),
            "current_shares": CaseService.get_case_shares(case_id, owner_doctor=owner_doctor, patient=patient),
            "candidates": CaseService.get_share_candidates(patient, owner_doctor, case_id),
        }

    @staticmethod
    def grant_read_only_access(patient: CustomUser, case_id: str, grantee_doctor: CustomUser, granted_by: CustomUser) -> Dict[str, Any]:
        owner_conn = CaseService.get_case_owner_connection(patient, case_id)
        if not owner_conn:
            raise ValueError("Case not found.")
        owner_doctor = owner_conn.doctor
        if int(owner_doctor.id) == int(grantee_doctor.id):
            raise ValueError("Cannot share a case with its owner.")
        if not TreatmentConnection.objects.filter(
            patient=patient,
            doctor=grantee_doctor,
            status=TreatmentConnection.Status.ACTIVE,
        ).exists():
            raise ValueError("The selected expert is not actively connected to this visitor.")
        if owner_doctor.expert_profession_id and owner_doctor.expert_profession_id != grantee_doctor.expert_profession_id:
            raise ValueError("Case access can only be shared with an expert of the same type.")
        if not CaseService.get_case(patient, int(owner_doctor.id), case_id):
            raise ValueError("Case not found.")
        grant, _ = CaseAccessGrant.objects.update_or_create(
            patient=patient,
            owner_doctor=owner_doctor,
            grantee_doctor=grantee_doctor,
            case_id=case_id,
            defaults={
                "access_mode": CaseAccessGrant.AccessMode.READ_ONLY,
                "status": CaseAccessGrant.Status.ACTIVE,
                "granted_by": granted_by,
            },
        )
        return CaseService._serialize_grant(grant)

    @staticmethod
    def revoke_read_only_access(patient: CustomUser, case_id: str, grantee_doctor_id: int) -> bool:
        updated = CaseAccessGrant.objects.filter(
            patient=patient,
            case_id=case_id,
            grantee_doctor_id=grantee_doctor_id,
            status=CaseAccessGrant.Status.ACTIVE,
        ).update(status=CaseAccessGrant.Status.REVOKED)
        return updated > 0

    @staticmethod
    def get_accessible_case_for_expert(patient: CustomUser, viewer_doctor: CustomUser, case_id: str) -> Optional[Dict[str, Any]]:
        if not case_id:
            return None
        owned_case = CaseService.get_case(patient, int(viewer_doctor.id), case_id)
        if owned_case:
            return CaseService._annotate_case_for_viewer(
                owned_case,
                patient=patient,
                owner_doctor=viewer_doctor,
                viewer_doctor=viewer_doctor,
                can_edit=True,
            )

        grant = CaseAccessGrant.objects.filter(
            patient=patient,
            grantee_doctor=viewer_doctor,
            case_id=case_id,
            status=CaseAccessGrant.Status.ACTIVE,
        ).select_related("owner_doctor", "owner_doctor__role", "owner_doctor__expert_profession").first()
        if not grant:
            return None
        owner_doctor = grant.owner_doctor
        owner_case = CaseService.get_case(patient, int(owner_doctor.id), case_id)
        if not owner_case:
            return None
        return CaseService._annotate_case_for_viewer(
            owner_case,
            patient=patient,
            owner_doctor=owner_doctor,
            viewer_doctor=viewer_doctor,
            can_edit=False,
        )

    @staticmethod
    def get_accessible_cases_for_expert(patient: CustomUser, viewer_doctor: CustomUser) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        for case_item in CaseService.get_cases(patient, int(viewer_doctor.id)):
            items.append(
                CaseService._annotate_case_for_viewer(
                    case_item,
                    patient=patient,
                    owner_doctor=viewer_doctor,
                    viewer_doctor=viewer_doctor,
                    can_edit=True,
                )
            )

        grants = CaseAccessGrant.objects.filter(
            patient=patient,
            grantee_doctor=viewer_doctor,
            status=CaseAccessGrant.Status.ACTIVE,
        ).select_related("owner_doctor", "owner_doctor__role", "owner_doctor__expert_profession")
        for grant in grants:
            owner_doctor = grant.owner_doctor
            owner_case = CaseService.get_case(patient, int(owner_doctor.id), grant.case_id)
            if not owner_case:
                continue
            items.append(
                CaseService._annotate_case_for_viewer(
                    owner_case,
                    patient=patient,
                    owner_doctor=owner_doctor,
                    viewer_doctor=viewer_doctor,
                    can_edit=False,
                )
            )

        items.sort(key=lambda item: item.get("updated_at") or item.get("created_at") or "", reverse=True)
        return items

    @staticmethod
    def get_or_create_selected_case_for_expert(
        patient: CustomUser,
        viewer_doctor: CustomUser,
        requested_case_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        existing = CaseService.get_accessible_case_for_expert(patient, viewer_doctor, requested_case_id or "")
        if existing:
            return existing
        accessible_cases = CaseService.get_accessible_cases_for_expert(patient, viewer_doctor)
        if accessible_cases:
            return accessible_cases[0]
        created = CaseService.create_case(patient, viewer_doctor)
        return CaseService._annotate_case_for_viewer(
            created,
            patient=patient,
            owner_doctor=viewer_doctor,
            viewer_doctor=viewer_doctor,
            can_edit=True,
        )

    @staticmethod
    def expert_can_view_case(patient: CustomUser, viewer_doctor: CustomUser, case_id: Optional[str]) -> bool:
        if not case_id:
            return False
        return CaseService.get_accessible_case_for_expert(patient, viewer_doctor, case_id) is not None

    @staticmethod
    def expert_can_edit_case(patient: CustomUser, viewer_doctor: CustomUser, case_id: Optional[str]) -> bool:
        if not case_id:
            return True
        case_item = CaseService.get_accessible_case_for_expert(patient, viewer_doctor, case_id)
        return bool(case_item and case_item.get("can_edit"))

    @staticmethod
    def get_accessible_cases_for_patient(patient: CustomUser) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        connections = CaseService._active_connections_for_patient(patient)
        for conn in connections:
            doctor_cases = CaseService.get_cases(patient, int(conn.doctor_id))
            if not doctor_cases:
                fallback = CaseService.create_case(patient, conn.doctor)
                doctor_cases = [fallback]
            for case_item in doctor_cases:
                payload = CaseService._annotate_case_for_viewer(
                    case_item,
                    patient=patient,
                    owner_doctor=conn.doctor,
                    viewer_doctor=None,
                    can_edit=True,
                )
                payload["shared_with"] = CaseService.get_case_shares(payload.get("id"), owner_doctor=conn.doctor, patient=patient)
                items.append(payload)
        items.sort(key=lambda item: item.get("updated_at") or item.get("created_at") or "", reverse=True)
        return items

    @staticmethod
    def get_latest_base_profile_entry(patient: CustomUser) -> Optional[UserContextEntry]:
        singleton_entry = user_context_manager.get_context(patient, CaseService.BASE_PROFILE_CONTEXT_KEY)
        if singleton_entry:
            return singleton_entry
        return UserContextEntry.objects.filter(
            user=patient,
            definition__key__startswith="clinical_form_base_profile_v1",
            is_active=True,
        ).order_by("-created_at").first()

    @staticmethod
    def save_base_profile(patient: CustomUser, data: Dict[str, Any], creator=None, source=UserContextEntry.SourceType.USER) -> UserContextEntry:
        payload = {
            "form_key": "BASE_PROFILE_V1",
            "form_title": "پرونده پایه",
            "visibility_scope": "SHARED_BASE",
            "case_id": None,
            **(data or {}),
        }
        return user_context_manager.set_singleton_context(
            user=patient,
            key=CaseService.BASE_PROFILE_CONTEXT_KEY,
            data=payload,
            source=source,
            creator=creator,
        )

    @staticmethod
    def build_patient_profile(patient: CustomUser) -> Dict[str, Any]:
        payload = {
            "id": patient.id,
            "name": patient.full_name or patient.phone_number,
            "phone": patient.phone_number,
        }
        base_entry = CaseService.get_latest_base_profile_entry(patient)
        if base_entry and isinstance(base_entry.data, dict):
            payload["name"] = base_entry.data.get("full_name") or payload["name"]
            payload["age"] = base_entry.data.get("birth_date")
            payload["job"] = f"{base_entry.data.get('job_status', '')} - {base_entry.data.get('job_title', '')}".strip(" -")
            payload["education"] = base_entry.data.get("education_level")
            payload["marital_status"] = base_entry.data.get("marital_status")
        return payload

    @staticmethod
    def get_visible_form_entries(
        patient: CustomUser,
        viewer_role: str,
        viewer_doctor_id: Optional[int] = None,
        case_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        entries = UserContextEntry.objects.filter(
            user=patient,
            definition__key__startswith="clinical_form_",
            is_active=True,
        ).select_related("definition").order_by("-created_at")

        history: List[Dict[str, Any]] = []
        for entry in entries:
            data = entry.data if isinstance(entry.data, dict) else {}
            form_key = data.get("form_key")
            submitted_by = int(data.get("submitted_by_doctor_id") or 0)
            entry_case_id = data.get("case_id")
            is_base_profile = form_key == "BASE_PROFILE_V1" or data.get("visibility_scope") == "SHARED_BASE"
            if is_base_profile:
                continue

            if viewer_role == "EXPERT":
                if viewer_doctor_id and submitted_by != int(viewer_doctor_id):
                    continue
                if case_id and entry_case_id != case_id:
                    continue
            else:
                if case_id and entry_case_id != case_id:
                    continue

            history.append({
                "id": str(entry.id),
                "form_key": form_key,
                "type": data.get("form_title", entry.definition.key.replace("clinical_form_", "")),
                "date": entry.created_at.isoformat(),
                "data": data,
                "case_id": entry_case_id,
                "is_base_profile": is_base_profile,
            })

        return history

    @staticmethod
    def get_visible_tests(
        patient: CustomUser,
        viewer_role: str,
        viewer_doctor_id: Optional[int] = None,
        case_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        from vania_core.tests_service import ClinicalTestsService

        tests: List[Dict[str, Any]] = []
        if viewer_role == "EXPERT" and viewer_doctor_id:
            for case_item in CaseService.get_cases(patient, int(viewer_doctor_id)):
                if case_id and case_item.get("id") != case_id:
                    continue
                tests.extend(ClinicalTestsService.get_tests(patient, doctor_id=int(viewer_doctor_id), case_id=case_item.get("id")))
        else:
            for case_item in CaseService.get_accessible_cases_for_patient(patient):
                if case_id and case_item.get("id") != case_id:
                    continue
                tests.extend(ClinicalTestsService.get_tests(patient, doctor_id=int(case_item["doctor_id"]), case_id=case_item.get("id")))

        tests.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        return tests
