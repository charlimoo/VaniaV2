from .constants import OPTS_GAF_SCORE


FORM_EDUCATION = {
    "key": "EDUCATION_V1",
    "title": "فرم شماره ۶: مشاوره تحصیلی",
    "description": "هدایت تحصیلی، بررسی تاریخچه رشد و آموزش، مطالعات تشخیصی و جمع‌بندی عملکرد تحصیلی.",
    "handler": "GenericFormHandler",
    "schema": [
        {
            "type": "section",
            "name": "education_referral",
            "title": "علت مراجعه",
            "description": "بخش‌های مشترک هویتی و پروفایل پایه در فرم `BASE_PROFILE_V1` ثبت می‌شوند؛ اینجا فقط محتوای تخصصی تحصیلی را ثبت کنید.",
            "fields": [
                {"name": "visit_reason_text", "label": "شرح مختصر علت مراجعه از زبان مراجع و اطرافیان", "type": "textarea", "width": "full"},
            ],
        },
        {
            "type": "section",
            "name": "education_history",
            "title": "سوابق تحصیلی و تحول شخصی",
            "description": "روند رشد، تجربه‌های یادگیری و وضعیت تحصیلی در دوره‌های مختلف را ثبت کنید.",
            "fields": [
                {"name": "history_prenatal_birth", "label": "۱-۱۷. دوران قبل از تولد و هنگام تولد", "type": "textarea", "width": "full"},
                {"name": "history_early_childhood", "label": "۲-۱۷. اوایل کودکی (تولد تا ۴ سالگی)", "type": "textarea", "width": "full"},
                {"name": "history_preschool", "label": "۳-۱۷. دوره پیش‌دبستانی (۴ تا ۶ سالگی)", "type": "textarea", "width": "full"},
                {"name": "history_elementary", "label": "۴-۱۷. دوره ابتدایی (۶ تا ۱۱ سالگی)", "type": "textarea", "width": "full"},
                {"name": "history_middle_school", "label": "۵-۱۷. دوره راهنمایی (۱۱ تا ۱۳ سالگی)", "type": "textarea", "width": "full"},
                {"name": "history_highschool", "label": "۶-۱۷. دوره دبیرستان (۱۳ تا ۱۸ سالگی)", "type": "textarea", "width": "full"},
                {"name": "history_higher_education", "label": "۷-۱۷. دوره تحصیلات دانشگاهی و مراکز آموزش عالی (۱۸ تا ۲۴ سالگی)", "type": "textarea", "width": "full"},
            ],
        },
        {
            "type": "section",
            "name": "education_self_awareness",
            "title": "خودشناسی و هدف‌گذاری",
            "description": "درک مراجع از ویژگی‌های خود و مسیرهای آینده تحصیلی و شغلی را مستند کنید.",
            "fields": [
                {"name": "self_awareness_traits", "label": "۱۸. شناخت فرد از ویژگی‌های خود", "type": "textarea", "width": "full"},
                {"name": "future_study_goals", "label": "۱۹. اهداف مراجع برای آینده تحصیلی", "type": "textarea", "width": "full"},
                {"name": "future_job_goals", "label": "۲۰. اهداف مراجع برای آینده شغلی", "type": "textarea", "width": "full"},
                {"name": "family_view_path", "label": "۲۱. نظر خانواده درباره مسیر مناسب تحصیلی و شغلی", "type": "textarea", "width": "full"},
            ],
        },
        {
            "type": "section",
            "name": "education_interventions",
            "title": "مداخلات و ارزیابی‌ها",
            "description": "سوابق مداخلات حرفه‌ای، مطالعات تکمیلی و نتایج ارزیابی‌های انجام‌شده را وارد کنید.",
            "fields": [
                {"name": "professional_interventions_history", "label": "۲۲. تاریخچه و سوابق مداخلات حرفه‌ای", "type": "textarea", "width": "full"},
                {"name": "additional_diagnostic_studies", "label": "۲۳. مطالعات تشخیصی بیشتر", "type": "textarea", "width": "full"},
                {"name": "tests_administered_summary", "label": "۲۴. آزمون‌های اجرا شده و خلاصه نتایج آن‌ها", "type": "textarea", "width": "full"},
                {"name": "positive_negative_findings", "label": "۲۵. خلاصه یافته‌های مثبت و منفی", "type": "textarea", "width": "full"},
            ],
        },
        {
            "type": "section",
            "name": "education_diagnosis",
            "title": "تشخیص و عملکرد",
            "description": "تشخیص‌های مبتنی بر DSM-5، پیش‌آگهی، ویژگی‌های توصیفی و سطح عملکرد را ثبت کنید.",
            "fields": [
                {"name": "diagnosis_primary", "label": "۱-۲۶. تشخیص اصلی", "type": "text", "width": "half"},
                {"name": "diagnosis_primary_code", "label": "کد تشخیص اصلی", "type": "text", "width": "half"},
                {"name": "diagnosis_secondary", "label": "۲-۲۶. تشخیص دوم", "type": "text", "width": "half"},
                {"name": "diagnosis_secondary_code", "label": "کد تشخیص دوم", "type": "text", "width": "half"},
                {"name": "diagnosis_tertiary", "label": "۳-۲۶. تشخیص سوم", "type": "text", "width": "half"},
                {"name": "diagnosis_tertiary_code", "label": "کد تشخیص سوم", "type": "text", "width": "half"},
                {"name": "prognosis", "label": "۲-۲۶. پیش‌بینی (Prognosis)", "type": "textarea", "width": "full"},
                {"name": "specifier_course", "label": "۳-۲۶. مسیر (خط سیر)", "type": "text", "width": "half"},
                {"name": "specifier_severity", "label": "شدت", "type": "text", "width": "half"},
                {"name": "specifier_frequency", "label": "فراوانی", "type": "text", "width": "half"},
                {"name": "specifier_duration", "label": "مدت", "type": "text", "width": "half"},
                {"name": "descriptive_features", "label": "ویژگی‌های توصیفی", "type": "textarea", "width": "full"},
                {
                    "name": "gaf_score",
                    "label": "۴-۲۶. عملکرد (GAF)",
                    "type": "select",
                    "options": OPTS_GAF_SCORE,
                    "width": "full",
                    "help_text": "در صورت نیاز از کدهای بینابینی مناسب مثل ۵۴، ۸۶ یا ۲۷ استفاده کنید.",
                },
                {"name": "functioning_notes", "label": "یادداشت تکمیلی درباره عملکرد", "type": "textarea", "width": "full"},
            ],
        },
        {
            "type": "section",
            "name": "education_recommendations",
            "title": "جمع‌بندی نهایی",
            "description": "پیشنهادهای اجرایی و مسیر پیگیری بعدی را ثبت کنید.",
            "fields": [
                {"name": "recommendations", "label": "۲۷. توصیه‌ها و پیشنهادها", "type": "textarea", "width": "full"},
            ],
        },
    ],
}
