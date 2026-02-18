# backend/capabilities/vania_doctor/forms/social_work.py

FORM_SOCIAL = {
    "key": "SOCIAL_V1",
    "title": "فرم شماره ۸: مددکاری",
    "description": "گزارش اقدامات مددکاری، بررسی علت ارجاع و طرح کمکی.",
    "handler": "GenericFormHandler",
    "schema": [
        # --- Page 1 Header ---
        {"name": "file_number", "label": "۱. شماره پرونده مراجع", "type": "text", "width": "half"},
        {"name": "file_date", "label": "۲. تاریخ تشکیل پرونده", "type": "date", "width": "half"},
        
        {"name": "full_name", "label": "۲. نام و نام خانوادگی مراجع", "type": "text", "width": "half"},
        {"name": "report_date", "label": "۴. تاریخ تهیه گزارش", "type": "date", "width": "half"},
        
        # --- Referral Info ---
        {
            "name": "referral_factor", 
            "label": "۵. عامل ارجاع", 
            "type": "select", 
            "options": [
                "روان‌پزشک",
                "روان‌شناس",
                "مشاور",
                "سایر موارد"
            ],
            "width": "half"
        },
        {"name": "referral_factor_other", "label": "توضیحات (در صورت انتخاب سایر)", "type": "text", "width": "half"},
        
        {"name": "referral_reason", "label": "۶. شرح مختصر علت ارجاع", "type": "textarea", "width": "full"},
        
        # --- Body ---
        {"name": "social_worker_actions", "label": "۷. گزارش اقدامات مددکار", "type": "textarea", "width": "full", "help_text": "شرح کامل اقدامات انجام شده"},
        
        {"name": "intervention_plan", "label": "۸. طرح کمکی (پیشنهادهای تخصصی)", "type": "textarea", "width": "full"},
    ]
}