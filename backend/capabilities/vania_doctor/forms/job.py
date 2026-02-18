# backend/capabilities/vania_doctor/forms/job.py
from .constants import (
    OPTS_MARITAL_STATUS, OPTS_EDUCATION, OPTS_MILITARY, 
    OPTS_JOB_STATUS, OPTS_REFERRAL
)

FORM_JOB = {
    "key": "JOB_V1",
    "title": "فرم شماره ۵: مشاوره شغلی",
    "description": "ارزیابی خودآگاهی شغلی، تحلیل فرصت‌ها/تهدیدها، هدف‌گذاری و تشخیص بالینی.",
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
        {"name": "education_level", "label": "وضعیت تحصیلی", "type": "select", "options": OPTS_EDUCATION, "width": "half"},
        {"name": "education_major", "label": "رشته تحصیلی", "type": "text", "width": "half"},
        
        {"name": "military_status", "label": "نظام وظیفه (آقایان)", "type": "select", "options": OPTS_MILITARY, "width": "half"},
        
        {"name": "job_status", "label": "وضعیت اشتغال", "type": "select", "options": OPTS_JOB_STATUS, "width": "half"},
        {"name": "job_type", "label": "نوع شغل", "type": "select", "options": ["آزاد", "دولتی", "سایر"], "width": "half"},
        {"name": "job_title", "label": "عنوان شغل", "type": "text", "width": "full"},
        
        {"name": "income_approx", "label": "درآمد تقریبی", "type": "text", "width": "half"},
        {"name": "referral_source", "label": "منبع ارجاع", "type": "select", "options": OPTS_REFERRAL, "width": "half"},
        
        {"name": "address_home", "label": "نشانی منزل و تلفن", "type": "textarea"},
        {"name": "address_work", "label": "نشانی محل کار و تلفن", "type": "textarea"},

        # --- Page 2: History & Awareness ---
        {
            "name": "family_history_grid",
            "label": "تاریخچه خانوادگی",
            "type": "datagrid",
            "columns": [
                {"name": "fullname", "label": "نام و نام خانوادگی", "type": "text"},
                {"name": "relation", "label": "نسبت", "type": "select", "options": ["پدر", "مادر", "خواهر", "برادر", "سایر"]},
                {"name": "age", "label": "سن", "type": "number"},
                {"name": "education", "label": "تحصیلات", "type": "text"},
                {"name": "job", "label": "شغل", "type": "text"},
                {"name": "marital", "label": "تأهل", "type": "select", "options": ["مجرد", "متاهل", "مطلقه", "بیوه"]},
                {"name": "description", "label": "توضیحات", "type": "text"}
            ]
        },
        {
            "name": "referral_reason_type",
            "label": "علت مراجعه",
            "type": "checkbox_group",
            "options": ["خودآگاهی شغلی", "آگاهی از فرصت‌ها", "جستجوی شغل", "ناسازگاری در شغل فعلی"]
        },
        
        # Self Awareness (Page 2)
        {"name": "life_values", "label": "۱. بررسی ارزش‌های زندگی", "type": "textarea"},
        {"name": "skills_abilities", "label": "۲. بررسی مهارت‌ها و توانایی‌های فرد", "type": "textarea"},
        {"name": "interests", "label": "۳. بررسی علاقه‌مندی‌های فرد شاغل", "type": "textarea"},
        {"name": "personality_job_fit", "label": "۴. شناخت سبک شخصیتی و شغلی (تناسب شغل و شاغل)", "type": "textarea"},
        {"name": "desired_role", "label": "۵. بررسی نقشی که فرد می‌خواهد در زندگی یا شغل بازی کند", "type": "textarea"},

        # --- Page 3: Impact & Opportunities ---
        {"name": "family_problems_job", "label": "۶. بررسی مشکلات خانوادگی ناشی از انتخاب/انجام شغل", "type": "textarea"},
        {"name": "cultural_problems_job", "label": "۷. بررسی مشکلات فرهنگی ناشی از انتخاب/انجام شغل", "type": "textarea"},
        {"name": "job_opportunities", "label": "۸. فرصت‌های این شغل برای فرد یا خانواده", "type": "textarea"},
        {"name": "job_threats", "label": "۹. تهدیدهای این شغل برای فرد یا خانواده", "type": "textarea"},
        
        # Opportunity Awareness (Page 3)
        {"name": "worthy_job_type", "label": "۱. فرد برای چه نوع شغلی فکر می‌کند شایستگی دارد؟", "type": "textarea"},
        {"name": "needed_position", "label": "۲. چه نوع موقعیت و پست شغلی فرد نیاز دارد؟", "type": "textarea"},
        {"name": "expected_training", "label": "۳. چه نوع آموزش، تجربه یا مهارتی فرد انتظار دارد؟", "type": "textarea"},
        {"name": "goal_clarity", "label": "۴. میزان آگاهی و شفاف بودن اهداف", "type": "text", "width": "full"},

        # --- Page 4: Goals & Search ---
        {"name": "short_long_term_goals", "label": "۵. شناسایی اهداف کوتاه‌مدت (زیر ۱ سال) و بلندمدت (۲ تا ۴ سال)", "type": "textarea"},
        {"name": "goal_strategy", "label": "۶. بررسی اینکه فرد چگونه می‌خواهد به اهداف خود برسد", "type": "textarea"},
        
        # Job Search
        {"name": "resume_skills", "label": "۱. مهارت تهیه رزومه کاری", "type": "textarea"},
        {"name": "interview_skills", "label": "۲. توانایی و آمادگی برای مصاحبه شغلی", "type": "textarea"},
        {"name": "search_skills", "label": "۳. مهارت جستجوی شغل", "type": "textarea"},
        
        {"name": "incompatibility_reason", "label": "بررسی دلیل ناسازگاری فرد شاغل (در صورت اشتغال)", "type": "textarea"},
        
        {"name": "dsm5_studies", "label": "مطالعات تشخیصی بیشتر (بر اساس DSM-5)", "type": "textarea"},

        # --- Page 5: Diagnosis ---
        {"name": "diagnosis_1", "label": "تشخیص ۱ (کد)", "type": "text", "width": "half"},
        {"name": "diagnosis_2", "label": "تشخیص ۲ (کد)", "type": "text", "width": "half"},
        {"name": "prognosis", "label": "پیش‌بینی (Prognosis)", "type": "textarea"},
        
        {"name": "specifier_course", "label": "مسیر (خط سیر)", "type": "text", "width": "half"},
        {"name": "specifier_severity", "label": "شدت", "type": "text", "width": "half"},
        {"name": "specifier_frequency", "label": "فراوانی", "type": "text", "width": "half"},
        {"name": "specifier_duration", "label": "مدت", "type": "text", "width": "half"},
        
        {"name": "descriptive_features", "label": "ویژگی‌های توصیفی", "type": "textarea"},
        {"name": "functioning_score", "label": "عملکرد (GAF/WHODAS)", "type": "text", "help_text": "نمره یا شرح عملکرد (۱۰۰-۱)"},

        # --- Page 6: Summary ---
        {"name": "final_summary", "label": "جمع‌بندی", "type": "textarea"},
        {"name": "recommendations", "label": "توصیه‌ها و پیشنهادها", "type": "textarea"},
    ]
}