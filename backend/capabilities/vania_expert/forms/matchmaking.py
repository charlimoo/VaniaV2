# backend/capabilities/vania_doctor/forms/matchmaking.py
from .constants import (
    OPTS_MARITAL_STATUS, OPTS_EDUCATION, OPTS_MILITARY, 
    OPTS_JOB_STATUS, OPTS_REFERRAL
)

# Scoring options based on PDF Page 4 Table columns
OPTS_SCORING_0_5 = [
    "0 - اصلاً",
    "1 - خیلی ضعیف",
    "2 - ضعیف",
    "3 - متوسط",
    "4 - خوب",
    "5 - خیلی خوب"
]

FORM_MATCHMAKING = {
    "key": "MATCHMAKING_V1",
    "title": "فرم شماره ۴: همسان‌گزینی",
    "description": "ارزیابی تخصصی برای انتخاب همسر، بررسی ملاک‌ها و جدول نمره‌گذاری همسان‌گزینی.",
    "handler": "GenericFormHandler", # Use specific handler if you want auto-calculation later
    "schema": [
        # --- Page 1: Demographics ---
        {"name": "file_number", "label": "شماره پرونده مراجع", "type": "text", "width": "half"},
        {"name": "file_date", "label": "تاریخ تشکیل پرونده", "type": "date", "width": "half"},
        
        {"name": "full_name", "label": "نام و نام خانوادگی", "type": "text", "width": "half"},
        {"name": "national_id", "label": "شماره ملی", "type": "text", "width": "half"},
        {"name": "gender", "label": "جنسیت", "type": "select", "options": ["مؤنث", "مذکر"], "width": "half"},
        {"name": "birth_date", "label": "تاریخ تولد", "type": "date", "width": "half"},
        
        {"name": "marital_status", "label": "وضعیت تأهل", "type": "select", "options": OPTS_MARITAL_STATUS, "width": "half"},
        {"name": "education_level", "label": "وضعیت تحصیلی", "type": "select", "options": OPTS_EDUCATION, "width": "half"},
        {"name": "education_major", "label": "رشته تحصیلی و مقطع", "type": "text", "width": "half"},
        {"name": "education_religious", "label": "دارای مدرک حوزوی", "type": "checkbox", "width": "half"},
        
        {"name": "military_status", "label": "وضعیت نظام وظیفه (آقایان)", "type": "select", "options": OPTS_MILITARY, "width": "half"},
        {"name": "military_exempt_reason", "label": "علت معافیت (در صورت وجود)", "type": "text", "width": "half"},
        
        {"name": "job_status", "label": "وضعیت اشتغال", "type": "select", "options": OPTS_JOB_STATUS, "width": "half"},
        {"name": "job_type", "label": "نوع شغل", "type": "select", "options": ["آزاد", "دولتی", "سایر"], "width": "half"},
        {"name": "job_title", "label": "عنوان شغل", "type": "text", "width": "full"},
        
        {"name": "income_approx", "label": "درآمد تقریبی", "type": "text", "width": "full"},
        
        {"name": "address_home", "label": "نشانی محل سکونت و تلفن", "type": "textarea"},
        {"name": "address_work", "label": "نشانی محل کار و تلفن", "type": "textarea"},
        
        {"name": "referral_source", "label": "منبع ارجاع یا طریقه آشنایی", "type": "select", "options": OPTS_REFERRAL, "width": "full"},

        # --- Page 2: Living Status & History ---
        {
            "name": "living_status_current", 
            "label": "۱۵. وضعیت زندگی فعلی", 
            "type": "select", 
            "options": ["مستقل", "همراه با والدین", "سایر"],
            "width": "half"
        },
        {
            "name": "living_status_desc", 
            "label": "توضیحات وضعیت زندگی", 
            "type": "text", 
            "width": "half"
        },
        
        {
            "name": "family_history_grid",
            "label": "۱۶. تاریخچه خانوادگی",
            "type": "datagrid",
            "columns": [
                {"name": "fullname", "label": "نام و نام خانوادگی", "type": "text"},
                {"name": "relation", "label": "نسبت", "type": "select", "options": ["پدر", "مادر", "خواهر", "برادر", "سایر"]},
                {"name": "age", "label": "سن", "type": "number"},
                {"name": "education", "label": "تحصیلات", "type": "text"},
                {"name": "job", "label": "شغل", "type": "text"},
                {"name": "marital", "label": "تأهل", "type": "select", "options": ["مجرد", "متاهل", "مطلقه", "بیوه"]},
                {"name": "description", "label": "سایر توضیحات (بیماری/مشکل)", "type": "text"}
            ]
        },
        
        # --- Page 2: Appearance ---
        {"name": "weight", "label": "۱-۱۷. وزن", "type": "text", "width": "half"},
        {"name": "height", "label": "۲-۱۷. قد", "type": "text", "width": "half"},
        {"name": "skin_color", "label": "۳-۱۷. رنگ پوست", "type": "text", "width": "half"},
        {"name": "eye_color", "label": "۴-۱۷. رنگ چشم", "type": "text", "width": "half"},
        {"name": "face_status", "label": "۵-۱۷. وضعیت چهره", "type": "select", "options": ["کمتر از معمولی", "معمولی", "زیبا", "خیلی زیبا"], "width": "half"},
        {"name": "clothing_style", "label": "۶-۱۷. وضعیت پوشش (خانم)", "type": "text", "width": "half"},
        {"name": "beard_style", "label": "۷-۱۷. وضعیت محاسن (آقا)", "type": "text", "width": "half"},
        
        {"name": "future_housing", "label": "۱۸. بررسی وضعیت مسکن پس از ازدواج", "type": "select", "options": ["مالک", "مستاجر", "سایر"], "width": "half"},
        {"name": "housing_notes", "label": "توضیحات مسکن", "type": "textarea", "width": "full"},

        # --- Page 3: Criteria & Tests ---
        {"name": "criteria_general", "label": "۱-۱۹. ملاک‌های انتخاب", "type": "textarea"},
        {"name": "expectations", "label": "۲-۱۹. انتظارات", "type": "textarea"},
        {"name": "special_conditions", "label": "۳-۱۹. شرایط خاص", "type": "textarea"},
        
        {"name": "mmpi_result", "label": "۱-۲۰. خلاصه نتیجه MMPI", "type": "textarea"},
        {"name": "neo_result", "label": "۲-۲۰. خلاصه نتیجه NEO", "type": "textarea"},
        {"name": "medication_history", "label": "۳-۲۰. سابقه بستری یا مصرف طولانی مدت داروها", "type": "textarea"},

        # --- Page 4: Scoring Matrix (23 items) ---
        {"name": "score_age", "label": "۱. تناسب سن", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_education", "label": "۲. تناسب تحصیلات", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_job", "label": "۳. تناسب شغلی", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_income", "label": "۴. تناسب درآمد ماهیانه", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_living_status", "label": "۵. وضعیت زندگی فعلی", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_appearance", "label": "۶. وضعیت ظاهری", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_military", "label": "۷. وضعیت نظام وظیفه (مخصوص آقایان)", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_demand", "label": "۸. تقاضای فعلی", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_prev_marriage", "label": "۹. سابقه ازدواج قبلی", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_housing", "label": "۱۰. وضعیت مسکن پس از ازدواج", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_social_class", "label": "۱۱. بررسی وضعیت طبقه اجتماعی خانواده", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_family_view", "label": "۱۲. نظر خانواده در مورد ازدواج", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_general_criteria", "label": "۱۳. ملاک‌های عمومی انتخاب", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_specific_criteria", "label": "۱۴. ملاک‌های اختصاصی انتخاب", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_expectations", "label": "۱۵. انتظار از طرف مقابل", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_health", "label": "۱۶. سلامت عمومی", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_mmpi", "label": "۱۷. نتایج حاصله از اجرای آزمون MMPI", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_neo", "label": "۱۸. نتایج حاصله از اجرای آزمون NEO", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_other_tests", "label": "۱۹. نتایج حاصله از اجرای سایر آزمون‌ها", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_special_cond", "label": "۲۰. شرایط خاص", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_religious", "label": "۲۱. بررسی وضعیت اعتقادی و مذهبی", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        {"name": "score_other_notes", "label": "۲۲. سایر ملاحظات", "type": "select", "options": OPTS_SCORING_0_5, "width": "half"},
        
        # Row 23 is "Total/Summary" in PDF table
        {"name": "score_total_manual", "label": "۲۳. جمع‌بندی نمرات (محاسبه دستی)", "type": "text", "width": "full"},

        # --- Page 5: Conclusion ---
        {"name": "advisor_suggestion", "label": "۳۵. پیشنهاد مشاور", "type": "textarea", "width": "full"},
    ]
}