# backend/capabilities/vania_doctor/forms/base_profile.py
from .constants import (
    OPTS_MARITAL_STATUS, OPTS_EDUCATION, OPTS_MILITARY, 
    OPTS_JOB_STATUS, OPTS_REFERRAL
)

FORM_BASE_PROFILE = {
    "key": "BASE_PROFILE_V1",
    "title": "پرونده پایه",
    "description": "اطلاعات پایه پرونده، مشخصات فردی، وضعیت شغلی و تاریخچه خانوادگی.",
    "handler": "GenericFormHandler", # Standard handler for now
    "schema": [
        # --- 1. Header ---
        {"name": "file_number", "label": "شماره پرونده مراجع", "type": "text"},
        {"name": "file_date", "label": "تاریخ تشکیل پرونده", "type": "date"},

        # --- 2. Personal Info ---
        {"name": "full_name", "label": "نام و نام خانوادگی", "type": "text"},
        {"name": "national_id", "label": "شماره ملی", "type": "text"},
        {"name": "gender", "label": "جنسیت", "type": "select", "options": ["مؤنث", "مذکر"]},
        {"name": "birth_date", "label": "تاریخ تولد", "type": "date"},

        # --- 3. Marital Status ---
        {"name": "marital_status", "label": "وضعیت تأهل", "type": "select", "options": OPTS_MARITAL_STATUS},
        {"name": "family_relation", "label": "نسبت فامیلی با همسر (در صورت وجود)", "type": "text"},
        {"name": "children_count", "label": "تعداد فرزندان", "type": "number"},

        # --- 4. Education ---
        {"name": "education_level", "label": "وضعیت تحصیلی", "type": "select", "options": OPTS_EDUCATION},
        {"name": "education_major", "label": "عنوان رشته تحصیلی و مقطع آن", "type": "text"},

        # --- 5. Military (Men) ---
        {"name": "military_status", "label": "وضعیت نظام وظیفه (مخصوص آقایان)", "type": "select", "options": OPTS_MILITARY},
        {"name": "military_exempt_reason", "label": "علت معافیت (در صورت انتخاب معافیت)", "type": "text"},

        # --- 6. Employment ---
        {"name": "job_status", "label": "وضعیت شغلی", "type": "select", "options": OPTS_JOB_STATUS},
        {"name": "job_type", "label": "نوع شغل", "type": "select", "options": ["آزاد", "دولتی"]},
        {"name": "job_title", "label": "عنوان شغل", "type": "text"},

        # --- 7. Contact & Financial ---
        {"name": "income_approx", "label": "درآمد تقریبی", "type": "text"},
        {"name": "address_home", "label": "نشانی محل سکونت و تلفن", "type": "textarea"},
        {"name": "address_work", "label": "نشانی محل کار و تلفن", "type": "textarea"},

        # --- 8. Referral ---
        # Note: Frontend needs to support multi-select or checkbox-group for this based on schema type
        {"name": "referral_source", "label": "منبع ارجاع", "type": "select", "options": OPTS_REFERRAL, "help_text": "نحوه آشنایی با مرکز"},

        # --- 9. Family History (Placeholder for Phase 2 Table) ---
        {
            "name": "family_history",
            "label": "جدول تاریخچه خانوادگی (پدر، مادر، خواهر/برادر)",
            "type": "datagrid", # New Type
            "help_text": "لطفاً برای هر عضو خانواده یک سطر اضافه کنید.",
            "columns": [
                {"name": "name", "label": "نام و نام خانوادگی", "type": "text"},
                {"name": "relation", "label": "نسبت", "type": "select", "options": ["پدر", "مادر", "خواهر", "برادر", "همسر", "فرزند", "سایر"]},
                {"name": "age", "label": "سن", "type": "number"},
                {"name": "education", "label": "تحصیلات", "type": "text"},
                {"name": "job", "label": "شغل", "type": "text"},
                {"name": "marital", "label": "تأهل", "type": "select", "options": ["مجرد", "متاهل", "مطلقه", "بیوه"]},
                {"name": "note", "label": "توضیحات (بیماری/مشکل)", "type": "text"}
            ]
        }
    ]
}