from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Iterable, List


EXPERT_DEFAULT_TABS = ["CASE_OVERVIEW", "ROADMAP", "RESCUENET", "MEDICATIONS", "APPENDIX", "FILES"]
VISITOR_DEFAULT_TABS = ["CASE_OVERVIEW", "RESCUENET", "MEDICATIONS", "TIMELINE", "LIBRARY", "FILES"]

EXPERT_OVERVIEW_DEFAULT_SECTIONS = [
    "clinical_summary",
    "forms_tests_analysis",
    "forms",
    "tests",
]
VISITOR_OVERVIEW_DEFAULT_SECTIONS = [
    "clinical_summary",
    "forms_tests_analysis",
    "tests",
]


_BASE_FEATURE_POLICY = {
    "show_clinical_summary": True,
    "show_forms_tests_analysis": True,
    "forms_enabled": True,
    "form_history_visible": True,
    "tests_visible": True,
    "files_enabled": True,
    "medications_enabled": True,
    "rescue_net_enabled": True,
    "appendix_enabled": True,
    "roadmap_enabled": True,
    "timeline_enabled": True,
    "library_enabled": True,
}


PROFESSION_POLICIES: Dict[str, Dict[str, Any]] = {
    "psychiatrist": {
        "expert_tabs": ["CASE_OVERVIEW", "ROADMAP", "MEDICATIONS"],
        "visitor_tabs": ["CASE_OVERVIEW", "MEDICATIONS", "TIMELINE"],
        "expert_case_overview_sections": deepcopy(EXPERT_OVERVIEW_DEFAULT_SECTIONS),
        "visitor_case_overview_sections": deepcopy(VISITOR_OVERVIEW_DEFAULT_SECTIONS),
        "disallowed_form_keys": [],
        "test_mode": "full_catalog",
        "allowed_tool_families": {
            "profiles",
            "case_management",
            "clinical_summary",
            "roadmap",
            "medications",
            "forms",
            "tests",
            "analysis",
        },
        "feature_policy": {
            **deepcopy(_BASE_FEATURE_POLICY),
            "files_enabled": False,
            "rescue_net_enabled": False,
            "appendix_enabled": False,
            "library_enabled": False,
        },
        "prompt_addition": (
            "You are operating as a psychiatrist. Do not use file tools, rescue-net tools, or thought-appendix workflows. "
            "Use medication, case summary, forms, tests, and roadmap features only."
        ),
    },
    "psychologist": {
        "expert_tabs": ["CASE_OVERVIEW", "ROADMAP", "RESCUENET", "APPENDIX"],
        "visitor_tabs": ["CASE_OVERVIEW", "RESCUENET", "TIMELINE", "LIBRARY"],
        "expert_case_overview_sections": deepcopy(EXPERT_OVERVIEW_DEFAULT_SECTIONS),
        "visitor_case_overview_sections": deepcopy(VISITOR_OVERVIEW_DEFAULT_SECTIONS),
        "disallowed_form_keys": ["PSYCHIATRY_V1"],
        "test_mode": "full_catalog",
        "allowed_tool_families": {
            "profiles",
            "case_management",
            "clinical_summary",
            "roadmap",
            "rescue_net",
            "appendix",
            "forms",
            "tests",
            "analysis",
        },
        "feature_policy": {
            **deepcopy(_BASE_FEATURE_POLICY),
            "files_enabled": False,
            "medications_enabled": False,
        },
        "prompt_addition": (
            "You are operating as a psychologist. Do not use medication tools or case-file tools. "
            "The psychiatry-specific form `PSYCHIATRY_V1` is not available in this workspace."
        ),
    },
    "lawyer": {
        "expert_tabs": ["CASE_OVERVIEW", "FILES"],
        "visitor_tabs": ["CASE_OVERVIEW", "FILES"],
        "expert_case_overview_sections": ["clinical_summary"],
        "visitor_case_overview_sections": ["clinical_summary"],
        "disallowed_form_keys": "__CASE_FORMS_DISABLED__",
        "test_mode": "disabled",
        "allowed_tool_families": {
            "profiles",
            "case_management",
            "clinical_summary",
            "forms",
            "files",
        },
        "feature_policy": {
            **deepcopy(_BASE_FEATURE_POLICY),
            "show_forms_tests_analysis": False,
            "forms_enabled": False,
            "form_history_visible": False,
            "tests_visible": False,
            "medications_enabled": False,
            "rescue_net_enabled": False,
            "appendix_enabled": False,
            "roadmap_enabled": False,
            "timeline_enabled": False,
            "library_enabled": False,
        },
        "prompt_addition": (
            "You are operating as a lawyer. Limit case work to the referral reason / observations summary and case files. "
            "Do not use therapy roadmap, rescue net, medication, appendix, or clinical test workflows."
        ),
    },
    "general_doctor": {
        "expert_tabs": ["CASE_OVERVIEW", "FILES"],
        "visitor_tabs": ["CASE_OVERVIEW", "FILES"],
        "expert_case_overview_sections": ["clinical_summary", "tests"],
        "visitor_case_overview_sections": ["clinical_summary", "tests"],
        "disallowed_form_keys": "__CASE_FORMS_DISABLED__",
        "test_mode": "exams_only",
        "allowed_tool_families": {
            "profiles",
            "case_management",
            "clinical_summary",
            "forms",
            "tests",
            "files",
        },
        "feature_policy": {
            **deepcopy(_BASE_FEATURE_POLICY),
            "show_forms_tests_analysis": False,
            "forms_enabled": False,
            "form_history_visible": False,
            "medications_enabled": False,
            "rescue_net_enabled": False,
            "appendix_enabled": False,
            "roadmap_enabled": False,
            "timeline_enabled": False,
            "library_enabled": False,
        },
        "prompt_addition": (
            "You are operating as a general doctor. Limit case work to the referral reason / observations summary, exam records, "
            "and case files. Do not use therapy roadmap, rescue net, medications, appendix, or generic psychology test prescribing. "
            "When recording tests, use manual exam entries only and do not rely on the psychology test catalog."
        ),
    },
}

DEFAULT_PROFESSION_POLICY = {
    "expert_tabs": ["CASE_OVERVIEW"],
    "visitor_tabs": ["CASE_OVERVIEW"],
    "expert_case_overview_sections": ["clinical_summary"],
    "visitor_case_overview_sections": ["clinical_summary"],
    "disallowed_form_keys": "__CASE_FORMS_DISABLED__",
    "test_mode": "disabled",
    "allowed_tool_families": {"profiles", "case_management", "clinical_summary", "forms"},
    "feature_policy": {
        **deepcopy(_BASE_FEATURE_POLICY),
        "show_forms_tests_analysis": False,
        "forms_enabled": False,
        "form_history_visible": False,
        "tests_visible": False,
        "files_enabled": False,
        "medications_enabled": False,
        "rescue_net_enabled": False,
        "appendix_enabled": False,
        "roadmap_enabled": False,
        "timeline_enabled": False,
        "library_enabled": False,
    },
    "prompt_addition": (
        "Your current profession configuration is restrictive. Limit activity to case selection, shared base-profile work, and "
        "the referral reason / observations summary unless the system exposes more tools."
    ),
}


def _copy_policy(policy: Dict[str, Any]) -> Dict[str, Any]:
    return {
        **policy,
        "expert_tabs": list(policy.get("expert_tabs", [])),
        "visitor_tabs": list(policy.get("visitor_tabs", [])),
        "expert_case_overview_sections": list(policy.get("expert_case_overview_sections", [])),
        "visitor_case_overview_sections": list(policy.get("visitor_case_overview_sections", [])),
        "allowed_tool_families": set(policy.get("allowed_tool_families", set())),
        "feature_policy": dict(policy.get("feature_policy", {})),
    }


def get_profession_policy(profession_slug: str | None) -> Dict[str, Any]:
    slug = (profession_slug or "").strip()
    base = PROFESSION_POLICIES.get(slug) or DEFAULT_PROFESSION_POLICY
    policy = _copy_policy(base)
    policy["profession_slug"] = slug or "unknown"
    policy["is_fallback"] = slug not in PROFESSION_POLICIES
    return policy


def get_user_profession_slug(user: Any) -> str | None:
    profession = getattr(user, "expert_profession", None)
    return getattr(profession, "slug", None)


def get_policy_for_user(user: Any) -> Dict[str, Any]:
    return get_profession_policy(get_user_profession_slug(user))


def is_tool_family_allowed(policy: Dict[str, Any], family: str) -> bool:
    return family in set(policy.get("allowed_tool_families", set()))


def resolve_allowed_form_keys(form_definitions: Iterable[Dict[str, Any]], profession_slug: str | None) -> List[str]:
    policy = get_profession_policy(profession_slug)
    disallowed = policy.get("disallowed_form_keys")
    allowed_keys: List[str] = []
    for form in form_definitions or []:
        key = form.get("key")
        if not key:
            continue
        if key == "BASE_PROFILE_V1":
            allowed_keys.append(key)
            continue
        if disallowed == "__CASE_FORMS_DISABLED__":
            continue
        if key in set(disallowed or []):
            continue
        allowed_keys.append(key)
    return allowed_keys


def filter_form_definitions(form_definitions: Iterable[Dict[str, Any]], profession_slug: str | None) -> List[Dict[str, Any]]:
    allowed_keys = set(resolve_allowed_form_keys(form_definitions, profession_slug))
    return [form for form in (form_definitions or []) if form.get("key") in allowed_keys]


def filter_form_entries(form_entries: Iterable[Dict[str, Any]], allowed_form_keys: Iterable[str]) -> List[Dict[str, Any]]:
    allowed = set(allowed_form_keys or [])
    result = []
    for entry in form_entries or []:
        form_key = entry.get("form_key") or entry.get("data", {}).get("form_key")
        if form_key in allowed:
            result.append(entry)
    return result


def filter_tests_catalog(test_catalog: Iterable[Dict[str, Any]], profession_slug: str | None) -> List[Dict[str, Any]]:
    policy = get_profession_policy(profession_slug)
    return list(test_catalog or []) if policy.get("test_mode") == "full_catalog" else []


def build_canvas_policy_payload(
    profession_slug: str | None,
    *,
    viewer: str,
    form_definitions: Iterable[Dict[str, Any]],
) -> Dict[str, Any]:
    policy = get_profession_policy(profession_slug)
    allowed_form_keys = resolve_allowed_form_keys(form_definitions, profession_slug)
    visible_tabs = policy["expert_tabs"] if viewer == "expert" else policy["visitor_tabs"]
    case_overview_sections = (
        policy["expert_case_overview_sections"] if viewer == "expert" else policy["visitor_case_overview_sections"]
    )
    return {
        "feature_policy": dict(policy.get("feature_policy", {})),
        "visible_tabs": list(visible_tabs),
        "case_overview_sections": list(case_overview_sections),
        "allowed_form_keys": allowed_form_keys,
        "test_mode": policy.get("test_mode", "disabled"),
        "profession_slug": policy.get("profession_slug"),
    }


def sanitize_expert_case_payload(case_payload: Dict[str, Any], profession_slug: str | None, allowed_form_keys: Iterable[str]) -> Dict[str, Any]:
    payload = dict(case_payload or {})
    policy = get_profession_policy(profession_slug)
    feature_policy = policy.get("feature_policy", {})

    payload["forms"] = filter_form_entries(payload.get("forms") or [], allowed_form_keys)
    if policy.get("test_mode") == "disabled":
        payload["tests"] = []
    if not feature_policy.get("appendix_enabled", False):
        payload["appendix_data"] = {"resources": []}
    if not feature_policy.get("medications_enabled", False):
        payload["medications"] = []
    if not feature_policy.get("rescue_net_enabled", False):
        payload["tasks"] = []
    if not feature_policy.get("roadmap_enabled", False):
        payload["roadmap_data"] = {
            "current_phase": "",
            "treatment_approaches": [],
            "sessions": [],
            "created_at": "",
            "updated_at": "",
        }
        payload["sessions"] = []
        payload["active_goals"] = []
    if not feature_policy.get("files_enabled", False):
        payload["files"] = []
    if not feature_policy.get("show_forms_tests_analysis", False):
        payload["forms_tests_analysis"] = ""
    if not feature_policy.get("show_clinical_summary", False):
        payload["clinical_summary"] = ""

    return payload


def sanitize_visitor_case_payload(case_payload: Dict[str, Any], profession_slug: str | None, allowed_form_keys: Iterable[str]) -> Dict[str, Any]:
    payload = dict(case_payload or {})
    policy = get_profession_policy(profession_slug)
    feature_policy = policy.get("feature_policy", {})

    payload["forms"] = filter_form_entries(payload.get("forms") or [], allowed_form_keys)
    if policy.get("test_mode") == "disabled":
        payload["tests"] = []
    if not feature_policy.get("appendix_enabled", False):
        payload["active_goals"] = []
    if not feature_policy.get("library_enabled", False):
        payload["library"] = []
    if not feature_policy.get("medications_enabled", False):
        payload["medications"] = []
    if not feature_policy.get("rescue_net_enabled", False):
        payload["tasks"] = []
    if not feature_policy.get("timeline_enabled", False):
        payload["timeline"] = []
    if not feature_policy.get("files_enabled", False):
        payload["files"] = []
    if not feature_policy.get("show_forms_tests_analysis", False):
        payload["forms_tests_analysis"] = ""
    if not feature_policy.get("show_clinical_summary", False):
        payload["clinical_summary"] = ""

    return payload
