from .constants import OPTS_SCORING_0_4

FORM_MARRIAGE = {
    "key": "MARRIAGE_V1",
    "title": "فرم شماره ۳: مشاوره ازدواج",
    "description": "ارزیابی پیش از ازدواج و محاسبه نمره تشابه (۰ تا ۴ برای هر ملاک).",
    "handler": "MarriageAssessmentHandler", 
    "schema": [
        # Matrix matching PDF Summary Table (Page 4)
        {"name": "score_age", "label": "۱. تناسب سن", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_education", "label": "۲. تناسب تحصیلات", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_job", "label": "۳. تناسب شغلی", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_income", "label": "۴. تناسب درآمد", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_living_status", "label": "۵. وضعیت زندگی فعلی", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_appearance", "label": "۶. وضعیت ظاهری", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_military", "label": "۷. نظام وظیفه", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_demand", "label": "۸. تقاضای فعلی", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_prev_marriage", "label": "۹. سابقه ازدواج قبلی", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_housing", "label": "۱۰. وضعیت مسکن آینده", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_social_class", "label": "۱۱. طبقه اجتماعی خانواده", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_family_view", "label": "۱۲. نظر خانواده‌ها", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_general_criteria", "label": "۱۳. ملاک‌های عمومی انتخاب", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_specific_criteria", "label": "۱۴. ملاک‌های اختصاصی", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_expectations", "label": "۱۵. انتظارات", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_health", "label": "۱۶. سلامت عمومی", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_mmpi", "label": "۱۷. نتایج MMPI", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_neo", "label": "۱۸. نتایج NEO", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_other_tests", "label": "۱۹. سایر آزمون‌ها", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_special_cond", "label": "۲۰. شرایط خاص", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_religious", "label": "۲۱. وضعیت اعتقادی", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        {"name": "score_other_notes", "label": "۲۲. سایر ملاحظات", "type": "select", "options": OPTS_SCORING_0_4, "width": "half"},
        
        {"name": "final_summary", "label": "جمع‌بندی نهایی", "type": "textarea", "width": "full"},
        {"name": "advisor_suggestion", "label": "پیشنهاد مشاور", "type": "textarea", "width": "full"},
    ]
}