# backend/capabilities/vania_doctor/form_definitions.py

# ==========================================
# HELPER CONSTANTS & OPTIONS
# ==========================================

OPTS_YES_NO = ["بله", "خیر"]

OPTS_SCORING_0_4 = [
    "0 - اصلاً / خیلی کم",
    "1 - کم",
    "2 - متوسط",
    "3 - زیاد",
    "4 - خیلی زیاد"
]

OPTS_MSE_MOOD = [
    "غمگین (Sad)",
    "مایوس (Despairing)",
    "خوشحال (Happy)",
    "افسرده (Depressed)",
    "بی تفاوت (Indifferent)",
    "مضطرب (Anxious)",
    "پرتنش (Tense)",
    "بیزار (Hostile)",
    "شرمسار (Ashamed)",
    "سرخوش (Euphoric)",
    "پژمرده (Apathetic)",
    "خود بزرگ بین (Grandise)"
]

OPTS_MSE_AFFECT = [
    "کند (Blunted)",
    "سطحی (Flat)",
    "نامناسب (Inappropriate)",
    "بی ثبات (Labile)",
    "متناسب با محتوا (Appropriate)"
]

OPTS_JOB_STATUS = [
    "شاغل", "حالت اشتغال", "خانه دار", "بازنشسته", "بیکار", "سایر"
]

OPTS_MARITAL_STATUS = [
    "مجرد", "نامزد", "عقد", "متاهل", "متارکه", "مطلقه", "بیوه"
]

OPTS_HOUSING = [
    "مالک", "مستاجر", "همراه با والدین", "سایر"
]

# ==========================================
# 1. PSYCHOLOGY (روان‌شناسی)
# ==========================================
FORM_PSYCHOLOGY = {
    "key": "PSYCHOLOGY_V1",
    "title": "فرم شماره ۱: روان‌شناسی",
    "description": "ارزیابی جامع بالینی، تاریخچه تحولی و معاینه وضعیت روانی (MSE).",
    "handler": "GenericFormHandler",
    "schema": [
        # --- A. Initial Info ---
        {"name": "chief_complaint_client", "label": "شکایت اصلی (از زبان مراجع)", "type": "textarea"},
        {"name": "chief_complaint_others", "label": "شکایت اصلی (از زبان اطرافیان)", "type": "textarea"},
        {"name": "history_present_illness", "label": "سابقه اختلال فعلی و سیر مشکل", "type": "textarea"},
        {"name": "past_psych_history", "label": "سابقه اختلال‌های قبلی", "type": "textarea"},
        {"name": "family_history_text", "label": "سابقه خانوادگی (توصیفی)", "type": "textarea"},
        
        # --- B. Developmental History ---
        {"name": "dev_prenatal", "label": "سوابق پیش از تولد و هنگام تولد", "type": "textarea"},
        {"name": "dev_childhood_early", "label": "اوایل کودکی (تولد تا ۳ سالگی)", "type": "textarea"},
        {"name": "dev_childhood_mid", "label": "اواسط کودکی (۳ تا ۶ سالگی)", "type": "textarea"},
        {"name": "dev_childhood_late", "label": "اواخر کودکی (۶ تا ۱۲ سالگی)", "type": "textarea"},
        {"name": "dev_adolescence", "label": "بلوغ و نوجوانی تا اواخر جوانی", "type": "textarea"},
        {"name": "dev_adulthood", "label": "بزرگسالی", "type": "textarea"},
        
        # --- C. Psychodynamics ---
        {"name": "fantasies_dreams", "label": "تخیلاّت و رویاها", "type": "textarea"},
        {"name": "values_past_future", "label": "ارزش‌گذاری نسبت به گذشته، حال و آینده", "type": "textarea"},
        {"name": "personality_changes", "label": "خصوصیات شخصیتی قبل و بعد از بیماری", "type": "textarea"},

        # --- D. Mental Status Exam (MSE) ---
        {"name": "mse_appearance_behavior", "label": "ظاهر و رفتار کلی", "type": "text"},
        {"name": "mse_attitude", "label": "نگرش نسبت به درمانگر", "type": "select", "options": ["همکار", "مدافع", "پرخاشگر", "بی‌تفاوت", "اغواگر", "بدبین"]},
        {"name": "mse_mood", "label": "خلق (Mood)", "type": "select", "options": OPTS_MSE_MOOD},
        {"name": "mse_affect", "label": "عاطفه (Affect)", "type": "select", "options": OPTS_MSE_AFFECT},
        {"name": "mse_speech", "label": "تکلم", "type": "text", "placeholder": "کند، سریع، پرفشار، لکنت..."},
        {"name": "mse_perception", "label": "ادراک (توهمات)", "type": "text", "placeholder": "شنوایی، بینایی، ..."},
        {"name": "mse_thought_process", "label": "جریان فکر", "type": "text", "placeholder": "حاشیه پردازی، پرش افکار..."},
        {"name": "mse_thought_content", "label": "محتوای فکر (هذیان)", "type": "text", "placeholder": "گزند و آسیب، بزرگ‌منشی..."},
        {"name": "mse_cognition", "label": "حافظه و تمرکز", "type": "text"},
        {"name": "mse_insight", "label": "بینش و قضاوت", "type": "text"},
        
        # --- E. Physical Functions ---
        {"name": "sleep_status", "label": "وضعیت و کیفیت خواب", "type": "text"},
        {"name": "sexual_status", "label": "رابطه جنسی و کیفیت آن", "type": "text"},
        {"name": "appetite_weight", "label": "تغذیه و وزن", "type": "text"},

        # --- F. Diagnosis ---
        {"name": "dsm5_diagnosis", "label": "تشخیص نهایی (DSM-5)", "type": "text"},
        {"name": "dsm5_code", "label": "کد تشخیص", "type": "text"},
        {"name": "prognosis", "label": "پیش‌بینی (Prognosis)", "type": "textarea"},
        {"name": "treatment_plan", "label": "طرح درمان", "type": "textarea"},
    ]
}

# ==========================================
# 2. FAMILY COUNSELING (مشاوره خانواده)
# ==========================================
FORM_FAMILY = {
    "key": "FAMILY_V1",
    "title": "فرم شماره ۲: مشاوره خانواده",
    "description": "بررسی پویایی سیستم خانواده، زوج درمانی و تعارضات.",
    "handler": "GenericFormHandler",
    "schema": [
        # --- Demographics ---
        {"name": "husband_name", "label": "نام و نام خانوادگی آقا", "type": "text"},
        {"name": "wife_name", "label": "نام و نام خانوادگی خانم", "type": "text"},
        {"name": "relationship_history", "label": "تاریخچه آشنایی، نامزدی و ازدواج", "type": "textarea"},
        
        # --- Complaint ---
        {"name": "complaint_main", "label": "شکایت اصلی", "type": "textarea"},
        {"name": "problem_history", "label": "سابقه مشکل فعلی", "type": "textarea"},
        {"name": "family_background_check", "label": "بررسی سطح فرهنگی/اجتماعی خانواده‌ها", "type": "textarea"},

        # --- Functioning (Dual Perspective) ---
        {"name": "view_personality_husband", "label": "ویژگی‌های شخصیتی (نظر آقا)", "type": "textarea"},
        {"name": "view_personality_wife", "label": "ویژگی‌های شخصیتی (نظر خانم)", "type": "textarea"},
        
        {"name": "view_communication_husband", "label": "مهارت‌های ارتباطی (نظر آقا)", "type": "textarea"},
        {"name": "view_communication_wife", "label": "مهارت‌های ارتباطی (نظر خانم)", "type": "textarea"},
        
        {"name": "view_conflict_husband", "label": "حل تعارض (نظر آقا)", "type": "textarea"},
        {"name": "view_conflict_wife", "label": "حل تعارض (نظر خانم)", "type": "textarea"},
        
        {"name": "view_financial_husband", "label": "موضوعات مالی (نظر آقا)", "type": "textarea"},
        {"name": "view_financial_wife", "label": "موضوعات مالی (نظر خانم)", "type": "textarea"},
        
        {"name": "view_sexual_husband", "label": "روابط زناشویی (نظر آقا)", "type": "textarea"},
        {"name": "view_sexual_wife", "label": "روابط زناشویی (نظر خانم)", "type": "textarea"},

        {"name": "view_parenting_husband", "label": "تربیت فرزند (نظر آقا)", "type": "textarea"},
        {"name": "view_parenting_wife", "label": "تربیت فرزند (نظر خانم)", "type": "textarea"},

        {"name": "view_inlaws_husband", "label": "ارتباط با بستگان (نظر آقا)", "type": "textarea"},
        {"name": "view_inlaws_wife", "label": "ارتباط با بستگان (نظر خانم)", "type": "textarea"},

        # --- Analysis ---
        {"name": "expectations_wife_of_husband", "label": "انتظارات خانم از آقا", "type": "textarea"},
        {"name": "expectations_husband_of_wife", "label": "انتظارات آقا از خانم", "type": "textarea"},
        
        {"name": "needs_awareness_wife", "label": "آگاهی خانم از نیازهای آقا", "type": "textarea"},
        {"name": "needs_awareness_husband", "label": "آگاهی آقا از نیازهای خانم", "type": "textarea"},
        
        {"name": "emotional_expression_wife", "label": "نحوه ابراز عاطفه خانم", "type": "text"},
        {"name": "emotional_expression_husband", "label": "نحوه ابراز عاطفه آقا", "type": "text"},

        {"name": "systemic_diagnosis", "label": "تشریح سیستم معیوب خانواده (تشخیص)", "type": "textarea"},
        {"name": "intervention_plan", "label": "طرح کمکی و پیشنهادات", "type": "textarea"},
    ]
}

# ==========================================
# 3. MARRIAGE COUNSELING (مشاوره ازدواج)
# ==========================================
FORM_MARRIAGE = {
    "key": "MARRIAGE_V1",
    "title": "فرم شماره ۳: مشاوره ازدواج",
    "description": "ارزیابی پیش از ازدواج و محاسبه نمره تشابه (۰ تا ۴).",
    "handler": "MarriageAssessmentHandler", # Points to custom logic in forms.py
    "schema": [
        # --- Info ---
        {"name": "suitor_name", "label": "نام آقا (خواستگار)", "type": "text"},
        {"name": "client_name", "label": "نام خانم (مراجع)", "type": "text"},
        
        # --- Scoring Matrix (0-4) ---
        {"name": "score_age", "label": "۱. تناسب سن", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_education", "label": "۲. تناسب تحصیلات", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_job", "label": "۳. تناسب شغلی", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_income", "label": "۴. تناسب درآمد ماهیانه", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_military", "label": "۵. وضعیت نظام وظیفه (آقا)", "type": "select", "options": OPTS_SCORING_0_4},
        
        {"name": "score_acquaintance_mode", "label": "۶. نحوه آشنایی", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_acquaintance_duration", "label": "۷. مدت آشنایی", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_marriage_history", "label": "۸. سابقه ازدواج قبلی", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_housing", "label": "۹. وضعیت مسکن پس از ازدواج", "type": "select", "options": OPTS_SCORING_0_4},
        
        {"name": "score_social_class", "label": "۱۰. طبقه اجتماعی خانواده", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_cultural_class", "label": "۱۱. طبقه فرهنگی خانواده", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_economic_class", "label": "۱۲. طبقه اقتصادی خانواده", "type": "select", "options": OPTS_SCORING_0_4},
        
        {"name": "score_family_opinion", "label": "۱۳. نظر خانواده‌ها", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_education_view", "label": "۱۴. دیدگاه طرفین به ادامه تحصیل", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_job_view", "label": "۱۵. دیدگاه طرفین به اشتغال زن", "type": "select", "options": OPTS_SCORING_0_4},
        
        {"name": "score_genetic_history", "label": "۱۶. سابقه اختلالات ژنتیک", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_health_history", "label": "۱۷. سابقه مشکلات جسمانی", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_mental_history", "label": "۱۸. سابقه مشکلات روانی", "type": "select", "options": OPTS_SCORING_0_4},
        
        {"name": "score_divorce_history", "label": "۱۹. سابقه طلاق در خانواده", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_addiction_history", "label": "۲۰. سابقه اعتیاد در خانواده", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_criminal_history", "label": "۲۱. سابقه کیفری", "type": "select", "options": OPTS_SCORING_0_4},
        
        {"name": "score_knowledge", "label": "۲۲. میزان شناخت از یکدیگر", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_test_results", "label": "۲۳. نتایج آزمون‌ها (MMPI/NEO)", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_belief_alignment", "label": "۲۴. همسویی اعتقادی و مذهبی", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_criteria_alignment", "label": "۲۵. همسویی ملاک‌های انتخاب", "type": "select", "options": OPTS_SCORING_0_4},
        {"name": "score_expectations", "label": "۲۶. همسویی انتظارات", "type": "select", "options": OPTS_SCORING_0_4},

        # --- Conclusion ---
        {"name": "counselor_strategy", "label": "راهبردها و توصیه‌های مشاور", "type": "textarea"},
    ]
}

# ==========================================
# 4. MATCHMAKING (همسان گزینی)
# ==========================================
FORM_MATCHMAKING = {
    "key": "MATCHMAKING_V1",
    "title": "فرم شماره ۴: همسان گزینی",
    "description": "پروفایل جامع فردی جهت معرفی کیس ازدواج.",
    "handler": "GenericFormHandler",
    "schema": [
        # --- Lifestyle ---
        {"name": "living_status", "label": "وضعیت زندگی فعلی", "type": "select", "options": ["مستقل", "همراه با والدین", "سایر"]},
        {"name": "housing_future", "label": "وضعیت مسکن پس از ازدواج", "type": "select", "options": OPTS_HOUSING},
        
        # --- Appearance ---
        {"name": "weight", "label": "وزن (kg)", "type": "text"},
        {"name": "height", "label": "قد (cm)", "type": "text"},
        {"name": "skin_color", "label": "رنگ پوست", "type": "text"},
        {"name": "eye_color", "label": "رنگ چشم", "type": "text"},
        {"name": "beauty_self_rate", "label": "وضعیت چهره (خودسنجی)", "type": "select", "options": ["معمولی", "زیبا", "خیلی زیبا", "کمتر از معمولی"]},
        {"name": "dress_code", "label": "وضعیت پوشش/محاسن", "type": "text"},
        
        # --- Criteria ---
        {"name": "selection_criteria", "label": "ملاک‌های انتخاب همسر", "type": "textarea"},
        {"name": "expectations", "label": "انتظارات از طرف مقابل", "type": "textarea"},
        {"name": "special_conditions", "label": "شرایط خاص", "type": "textarea"},

        # --- Psychometrics ---
        {"name": "test_mmpi_result", "label": "خلاصه نتیجه MMPI", "type": "textarea"},
        {"name": "test_neo_result", "label": "خلاصه نتیجه NEO", "type": "textarea"},
        {"name": "medication_history", "label": "سابقه بستری یا مصرف دارو", "type": "textarea"},
        
        {"name": "final_suggestion", "label": "پیشنهاد مشاور", "type": "textarea"},
    ]
}

# ==========================================
# 5. JOB COUNSELING (مشاوره شغلی)
# ==========================================
FORM_JOB = {
    "key": "JOB_V1",
    "title": "فرم شماره ۵: مشاوره شغلی",
    "description": "هدایت شغلی، بررسی مهارت‌ها و مقیاس عملکرد (GAF).",
    "handler": "GenericFormHandler",
    "schema": [
        {"name": "visit_reason", "label": "علت مراجعه", "type": "select", "options": ["خودآگاهی شغلی", "جستجوی شغل", "ناسازگاری در شغل فعلی", "آگاهی از فرصت‌ها"]},
        
        # --- Self Awareness ---
        {"name": "values_life", "label": "ارزش‌های زندگی", "type": "textarea"},
        {"name": "skills_abilities", "label": "مهارت‌ها و توانایی‌ها", "type": "textarea"},
        {"name": "interests", "label": "علاقه‌مندی‌ها", "type": "textarea"},
        {"name": "personality_style", "label": "سبک شخصیتی و تناسب شغلی", "type": "textarea"},
        
        # --- External Factors ---
        {"name": "family_problems_job", "label": "مشکلات خانوادگی ناشی از شغل", "type": "textarea"},
        {"name": "cultural_problems_job", "label": "مشکلات فرهنگی ناشی از شغل", "type": "textarea"},
        
        # --- Opportunities ---
        {"name": "perceived_competence", "label": "فرد خود را شایسته چه شغلی می‌داند؟", "type": "text"},
        {"name": "required_position", "label": "چه نوع پست شغلی نیاز دارد؟", "type": "text"},
        {"name": "training_expectations", "label": "انتظار آموزشی/تجربی از شغل", "type": "text"},
        
        # --- Goals ---
        {"name": "goals_clarity", "label": "میزان شفافیت اهداف", "type": "text"},
        {"name": "goals_short_long", "label": "اهداف کوتاه مدت و بلند مدت", "type": "textarea"},
        {"name": "strategy_to_reach", "label": "چگونه به اهداف خود می‌رسد؟", "type": "textarea"},
        
        # --- Skills ---
        {"name": "resume_skills", "label": "مهارت رزومه‌نویسی", "type": "text"},
        {"name": "interview_skills", "label": "آمادگی مصاحبه شغلی", "type": "text"},
        
        # --- Diagnosis & GAF ---
        {"name": "dsm_diagnosis", "label": "تشخیص تکمیلی (DSM-5)", "type": "text"},
        {"name": "gaf_score_code", "label": "کد عملکرد (GAF Range)", "type": "select", "options": [
            "100-91 (عالی)", "90-81 (خوب/بدون علائم)", "80-71 (علائم گذرا)", "70-61 (خفیف)", 
            "60-51 (متوسط)", "50-41 (جدی)", "40-31 (تخریب نسبی)", "30-21 (تحت تأثیر هذیان)", 
            "20-11 (خطر نسبی)", "10-1 (خطر دائم)"
        ]},
        {"name": "summary_recommendation", "label": "جمع‌بندی و توصیه‌ها", "type": "textarea"},
    ]
}

# ==========================================
# 6. EDUCATIONAL COUNSELING (مشاوره تحصیلی)
# ==========================================
FORM_EDUCATION = {
    "key": "EDUCATION_V1",
    "title": "فرم شماره ۶: مشاوره تحصیلی",
    "description": "هدایت تحصیلی، بررسی افت تحصیلی و برنامه‌ریزی.",
    "handler": "GenericFormHandler",
    "schema": [
        {"name": "visit_reason_text", "label": "شرح مختصر علت مراجعه", "type": "textarea"},
        
        # --- History ---
        {"name": "history_prenatal", "label": "دوران قبل و هنگام تولد", "type": "text"},
        {"name": "history_early_childhood", "label": "اوایل کودکی (تا ۴ سالگی)", "type": "text"},
        {"name": "history_preschool", "label": "پیش دبستانی (۴ تا ۶)", "type": "text"},
        {"name": "history_elementary", "label": "دوره ابتدایی (۶ تا ۱۱)", "type": "text"},
        {"name": "history_guidance", "label": "دوره راهنمایی (۱۱ تا ۱۳)", "type": "text"},
        {"name": "history_highschool", "label": "دوره دبیرستان (۱۳ تا ۱۸)", "type": "text"},
        {"name": "history_university", "label": "دانشگاه (۱۸ تا ۲۴)", "type": "text"},
        
        # --- Assessment ---
        {"name": "self_knowledge", "label": "شناخت فرد از ویژگی‌های خود", "type": "textarea"},
        {"name": "academic_goals", "label": "اهداف تحصیلی مراجع", "type": "textarea"},
        {"name": "career_goals", "label": "اهداف شغلی مراجع", "type": "textarea"},
        {"name": "family_opinion", "label": "نظر خانواده در مورد مسیر تحصیلی", "type": "textarea"},
        
        {"name": "intervention_history", "label": "تاریخچه مداخلات حرفه‌ای قبلی", "type": "textarea"},
        {"name": "diagnostic_tests", "label": "آزمون‌های اجرا شده و نتایج", "type": "textarea"},
        {"name": "positive_negative_findings", "label": "خلاصه یافته‌های مثبت و منفی", "type": "textarea"},
        
        # --- Diagnosis ---
        {"name": "dsm_diagnosis", "label": "مشکل عمده تشخیص (DSM-5)", "type": "text"},
        {"name": "prognosis", "label": "پیش‌بینی (Prognosis)", "type": "text"},
        {"name": "recommendations", "label": "توصیه‌ها و پیشنهادها", "type": "textarea"},
    ]
}

# ==========================================
# 7. PSYCHIATRY (روان‌پزشکی)
# ==========================================
FORM_PSYCHIATRY = {
    "key": "PSYCHIATRY_V1",
    "title": "فرم شماره ۷: روان‌پزشکی",
    "description": "ویزیت دارویی، تاریخچه پزشکی و MSE.",
    "handler": "GenericFormHandler",
    "schema": [
        # --- Family History Table Placeholder ---
        {"name": "family_medical_history", "label": "تاریخچه خانوادگی (بیماری‌های روانی/جسمی)", "type": "textarea"},
        
        # --- Referral ---
        {"name": "referral_reason", "label": "شرح مختصر علت ارجاع", "type": "textarea"},
        {"name": "clinical_findings", "label": "خلاصه یافته‌های مثبت/منفی (تست و مصاحبه)", "type": "textarea"},
        
        # --- Diagnosis ---
        {"name": "dsm_diagnosis_1", "label": "تشخیص ۱ (DSM-5)", "type": "text"},
        {"name": "dsm_diagnosis_2", "label": "تشخیص ۲ (DSM-5)", "type": "text"},
        {"name": "prognosis", "label": "پیش‌بینی", "type": "textarea"},
        {"name": "specifiers", "label": "تعیین کننده‌ها (شدت، مسیر، ویژگی‌ها)", "type": "text"},
        
        # --- Treatment ---
        {"name": "medication_plan", "label": "طرح درمان دارویی (نسخه)", "type": "textarea"},
    ]
}

# ==========================================
# 8. SOCIAL WORK (مددکاری)
# ==========================================
FORM_SOCIAL = {
    "key": "SOCIAL_V1",
    "title": "فرم شماره ۸: مددکاری",
    "description": "گزارش اقدامات مددکار و طرح‌های حمایتی.",
    "handler": "GenericFormHandler",
    "schema": [
        {"name": "referral_agent", "label": "عامل ارجاع (روانشناس/پزشک)", "type": "text"},
        {"name": "referral_reason", "label": "شرح مختصر علت ارجاع", "type": "textarea"},
        {"name": "actions_report", "label": "گزارش اقدامات مددکار", "type": "textarea"},
        {"name": "aid_plan", "label": "طرح کمکی (پیشنهادهای تخصصی)", "type": "textarea"},
    ]
}

# ==========================================
# MASTER LIST
# ==========================================
ALL_FORMS_LIST = [
    FORM_PSYCHOLOGY,
    FORM_FAMILY,
    FORM_MARRIAGE,
    FORM_MATCHMAKING,
    FORM_JOB,
    FORM_EDUCATION,
    FORM_PSYCHIATRY,
    FORM_SOCIAL
]