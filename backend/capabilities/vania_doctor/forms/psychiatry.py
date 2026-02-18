# backend/capabilities/vania_doctor/forms/psychiatry.py
from .constants import (
    OPTS_MARITAL_STATUS, OPTS_EDUCATION, OPTS_MILITARY, 
    OPTS_JOB_STATUS, OPTS_REFERRAL
)

FORM_PSYCHIATRY = {
    "key": "PSYCHIATRY_V1",
    "title": "فرم شماره ۷: روان‌پزشکی",
    "description": "ارزیابی تخصصی روان‌پزشکی، معاینه وضعیت روانی (MSE) و تشخیص‌گذاری بر اساس DSM-5.",
    "handler": "GenericFormHandler",
    "schema": [
        # --- Page 1: Demographics ---
        {"name": "file_number", "label": "شماره پرونده", "type": "text", "width": "half"},
        {"name": "file_date", "label": "تاریخ تشکیل پرونده", "type": "date", "width": "half"},
        
        {"name": "full_name", "label": "نام و نام خانوادگی", "type": "text", "width": "half"},
        {"name": "national_id", "label": "شماره ملی", "type": "text", "width": "half"},
        {"name": "gender", "label": "جنسیت", "type": "select", "options": ["مؤنث", "مذکر"], "width": "half"},
        {"name": "birth_date", "label": "تاریخ تولد", "type": "date", "width": "half"},
        
        {"name": "marital_status", "label": "وضعیت تأهل", "type": "select", "options": OPTS_MARITAL_STATUS, "width": "half"},
        {"name": "children_count", "label": "تعداد فرزندان", "type": "number", "width": "half"},
        
        {"name": "education_level", "label": "وضعیت تحصیلی", "type": "select", "options": OPTS_EDUCATION, "width": "half"},
        {"name": "education_major", "label": "رشته تحصیلی", "type": "text", "width": "half"},
        
        {"name": "military_status", "label": "نظام وظیفه (آقایان)", "type": "select", "options": OPTS_MILITARY, "width": "half"},
        
        {"name": "job_status", "label": "وضعیت اشتغال", "type": "select", "options": OPTS_JOB_STATUS, "width": "half"},
        {"name": "job_type", "label": "نوع شغل", "type": "select", "options": ["آزاد", "دولتی", "سایر"], "width": "half"},
        {"name": "job_title", "label": "عنوان شغل", "type": "text", "width": "full"},
        
        {"name": "income_approx", "label": "درآمد تقریبی", "type": "text", "width": "half"},
        {"name": "referral_source", "label": "منبع ارجاع (عمومی)", "type": "select", "options": OPTS_REFERRAL, "width": "half"},
        
        {"name": "address_home", "label": "نشانی منزل و تلفن", "type": "textarea"},
        {"name": "address_work", "label": "نشانی محل کار و تلفن", "type": "textarea"},

        # --- Page 2: History Table & Clinical Referral ---
        {
            "name": "family_history_grid",
            "label": "تاریخچه خانوادگی (۱۵)",
            "type": "datagrid",
            "columns": [
                {"name": "fullname", "label": "نام و نام خانوادگی", "type": "text"},
                {"name": "relation", "label": "نسبت", "type": "select", "options": ["پدر", "مادر", "خواهر", "برادر", "سایر"]},
                {"name": "age", "label": "سن", "type": "number"},
                {"name": "education", "label": "تحصیلات", "type": "text"},
                {"name": "job", "label": "شغل", "type": "text"},
                {"name": "marital", "label": "تأهل", "type": "select", "options": ["مجرد", "متاهل", "مطلقه", "بیوه"]},
                {"name": "notes", "label": "توضیحات (بیماری/مشکل)", "type": "text"}
            ]
        },
        {
            "name": "referral_clinical_type",
            "label": "۱۶. عامل ارجاع (تخصصی)",
            "type": "select",
            "options": ["روان‌شناس", "مشاور", "مددکار", "روان‌پزشک", "سایر"],
            "width": "half"
        },
        {"name": "referral_person_name", "label": "نام ارجاع دهنده", "type": "text", "width": "half"},
        {"name": "referral_reason_clinical", "label": "شرح مختصر علت ارجاع", "type": "textarea"},
        {"name": "clinical_findings_summary", "label": "خلاصه یافته‌های مثبت و منفی (نتایج تست و مصاحبه)", "type": "textarea"},
        
        # Initial Diagnosis (Page 2 Bottom)
        {"name": "initial_diagnosis_1", "label": "تشخیص اولیه ۱ (کد DSM)", "type": "text", "width": "full"},
        {"name": "initial_diagnosis_2", "label": "تشخیص اولیه ۲ (کد DSM)", "type": "text", "width": "full"},

        # --- Page 3: Detailed History (Anamnesis) ---
        {"name": "chief_complaint_client", "label": "۱-۱. شکایت اصلی (از زبان مراجع)", "type": "textarea"},
        {"name": "chief_complaint_others", "label": "۱-۲. شکایت اصلی (از زبان اطرافیان)", "type": "textarea"},
        
        {"name": "hpi_course", "label": "۲-۱. سابقه اختلال فعلی (سیر مشکل)", "type": "textarea"},
        {"name": "hpi_actions", "label": "۲-۲. اقدامات انجام شده برای اختلال فعلی", "type": "textarea"},
        
        {"name": "past_psych_history", "label": "۳. سابقه اختلال‌های قبلی", "type": "textarea"},
        {"name": "family_history_text", "label": "۴. سابقه خانوادگی (توصیفی)", "type": "textarea"},

        # --- Page 4: Mental Status Examination (MSE) ---
        {"name": "mse_mood", "label": "۵-۱. خلق (Mood)", "type": "text", "width": "half"},
        {"name": "mse_affect", "label": "۵-۲. عاطفه (Affect)", "type": "text", "width": "half"},
        {"name": "mse_speech", "label": "۶. تکلم (Conversation)", "type": "text", "width": "half"},
        {"name": "mse_perception", "label": "۷. ادراک (Perception)", "type": "text", "width": "half"},
        {"name": "mse_thinking", "label": "۸. تفکر (Thinking)", "type": "text", "width": "full"},
        
        {"name": "mse_hallucination", "label": "۸-۱. اختلال در جریان فکر (Hallucination)", "type": "text", "width": "half"},
        {"name": "mse_delusion", "label": "۸-۲. اختلال در محتوای فکر (Delusion)", "type": "text", "width": "half"},
        
        {"name": "mse_awareness", "label": "۹. سطح هشیاری (Awareness Level)", "type": "text", "width": "half"},
        {"name": "mse_orientation", "label": "۱۰. جهت‌یابی (Orientation)", "type": "text", "width": "half"},

        # Memory Checkboxes (Mapped to Selects for Simplicity)
        {
            "name": "mse_memory_long", 
            "label": "۱۱-۱. وضعیت حافظه بلند مدت", 
            "type": "select", 
            "options": ["خوب", "متوسط", "بد"], 
            "width": "half"
        },
        {
            "name": "mse_memory_short", 
            "label": "۱۱-۲. وضعیت حافظه کوتاه مدت", 
            "type": "select", 
            "options": ["خوب", "متوسط", "بد"], 
            "width": "half"
        },
        {
            "name": "mse_memory_immediate", 
            "label": "۱۱-۳. وضعیت حافظه فوری", 
            "type": "select", 
            "options": ["خوب", "متوسط", "بد"], 
            "width": "half"
        },
        
        {"name": "mse_attention", "label": "۱۲. تمرکز و توجه", "type": "text", "width": "half"},
        {"name": "mse_abstract", "label": "۱۳. تفکر انتزاعی", "type": "text", "width": "half"},
        {"name": "mse_intelligence", "label": "۱۴. سطح اطلاعات عمومی و هوشی", "type": "text", "width": "full"},
        
        {"name": "mse_sleep", "label": "۱۵. وضعیت خواب و کیفیت آن", "type": "text", "width": "half"},
        {"name": "mse_sexual", "label": "۱۶. رابطه جنسی و کیفیت آن", "type": "text", "width": "half"},
        {"name": "mse_impulse", "label": "۱۷. کنترل تکانه", "type": "text", "width": "half"},
        {"name": "mse_judgment", "label": "۱۸. قضاوت (Adjudication)", "type": "text", "width": "half"},
        {"name": "mse_insight", "label": "۱۹. بینش (Insight)", "type": "text", "width": "half"},
        {"name": "mse_other", "label": "۲۰. موارد دیگر", "type": "textarea"},

        # --- Page 5: Final Diagnosis & Plan ---
        {"name": "final_diagnosis_1", "label": "۲۱. تشخیص ۱ (کد DSM-5)", "type": "text", "width": "full"},
        {"name": "final_diagnosis_2", "label": "تشخیص ۲ (کد DSM-5)", "type": "text", "width": "full"},
        {"name": "final_diagnosis_3", "label": "تشخیص ۳ (کد DSM-5)", "type": "text", "width": "full"},
        
        {"name": "prognosis", "label": "۲-۲۱. پیش‌بینی (Prognosis)", "type": "textarea"},
        
        # Specifiers
        {"name": "specifier_course", "label": "مسیر (خط سیر)", "type": "text", "width": "half"},
        {"name": "specifier_severity", "label": "شدت", "type": "text", "width": "half"},
        {"name": "specifier_frequency", "label": "فراوانی", "type": "text", "width": "half"},
        {"name": "specifier_duration", "label": "مدت", "type": "text", "width": "half"},
        {"name": "specifier_features", "label": "ویژگی‌های توصیفی", "type": "textarea"},
        
        {"name": "medication_plan", "label": "۲۲. طرح درمان دارویی", "type": "textarea", "width": "full"},
    ]
}