from .constants import OPTS_MSE_MOOD, OPTS_MSE_AFFECT

FORM_PSYCHOLOGY = {
    "key": "PSYCHOLOGY_V1",
    "title": "فرم شماره ۱: روان‌شناسی",
    "description": "ارزیابی جامع بالینی، تاریخچه تحولی و معاینه وضعیت روانی (MSE).",
    "handler": "GenericFormHandler",
    "schema": [
        {"name": "chief_complaint_client", "label": "شکایت اصلی (از زبان مراجع)", "type": "textarea"},
        {"name": "chief_complaint_others", "label": "شکایت اصلی (از زبان اطرافیان)", "type": "textarea"},
        {"name": "history_present_illness", "label": "سابقه اختلال فعلی و سیر مشکل", "type": "textarea"},
        {"name": "past_psych_history", "label": "سابقه اختلال‌های قبلی", "type": "textarea"},
        {"name": "family_history_text", "label": "سابقه خانوادگی (توصیفی)", "type": "textarea"},
        
        {"name": "dev_prenatal", "label": "سوابق پیش از تولد و هنگام تولد", "type": "textarea"},
        {"name": "dev_childhood_early", "label": "اوایل کودکی (تولد تا ۳ سالگی)", "type": "textarea"},
        {"name": "dev_childhood_mid", "label": "اواسط کودکی (۳ تا ۶ سالگی)", "type": "textarea"},
        {"name": "dev_childhood_late", "label": "اواخر کودکی (۶ تا ۱۲ سالگی)", "type": "textarea"},
        {"name": "dev_adolescence", "label": "بلوغ و نوجوانی تا اواخر جوانی", "type": "textarea"},
        {"name": "dev_adulthood", "label": "بزرگسالی", "type": "textarea"},
        
        {"name": "fantasies_dreams", "label": "تخیلاّت و رویاها", "type": "textarea"},
        {"name": "values_past_future", "label": "ارزش‌گذاری نسبت به گذشته، حال و آینده", "type": "textarea"},
        {"name": "personality_changes", "label": "خصوصیات شخصیتی قبل و بعد از بیماری", "type": "textarea"},

        # MSE
        {"name": "mse_appearance", "label": "ظاهر و رفتار کلی", "type": "text", "width": "full"},
        {
            "name": "mse_attitude", 
            "label": "نگرش نسبت به درمانگر", 
            "type": "checkbox_group", # Changed from select
            "options": ["تحریک پذیر", "پرخاشگر", "اغواگر", "دفاعی", "بی تفاوت", "بی احساس", "همکار", "نیشدار"]
        },
        {
            "name": "mse_mood", 
            "label": "خلق (Mood)", 
            "type": "checkbox_group", 
            "options": OPTS_MSE_MOOD
        },
        {
            "name": "mse_affect", 
            "label": "عاطفه (Affect)", 
            "type": "checkbox_group", 
            "options": OPTS_MSE_AFFECT
        },
        {
            "name": "mse_speech", 
            "label": "تکلم", 
            "type": "checkbox_group", 
            "options": ["کند", "سریع", "پرفشار", "وراج", "خودانگیز", "کم‌حرف", "لکنت", "منقطع", "پرگویی"]
        },
        {
            "name": "mse_perception", 
            "label": "ادراک (توهمات)", 
            "type": "checkbox_group", 
            "options": ["توهم شنوایی", "توهم بینایی", "توهم بویایی", "توهم لامسه", "تجارب درکی غیرعادی"]
        },
        {
            "name": "mse_thought_process", 
            "label": "جریان فکر", 
            "type": "checkbox_group", 
            "options": ["حاشیه پردازی", "پرش افکار", "فشار تکلم", "شل شدن تداعی", "بی ربطی کلام", "واژه سازی"]
        },
        {
            "name": "mse_thought_content", 
            "label": "محتوای فکر (هذیان)", 
            "type": "checkbox_group", 
            "options": ["گزند و آسیب", "بزرگ‌منشی", "بدبینی", "افکار جادویی", "انتساب به خود", "خیانت همسر"]
        },
        {"name": "mse_cognition", "label": "حافظه و تمرکز", "type": "text"},
        {"name": "mse_insight", "label": "بینش و قضاوت", "type": "text"},
        
        {"name": "sleep_status", "label": "وضعیت و کیفیت خواب", "type": "text"},
        {"name": "sexual_status", "label": "رابطه جنسی و کیفیت آن", "type": "text"},
        {"name": "appetite_weight", "label": "تغذیه و وزن", "type": "text"},

        {"name": "dsm5_diagnosis", "label": "تشخیص نهایی (DSM-5)", "type": "text"},
        {"name": "dsm5_code", "label": "کد تشخیص", "type": "text"},
        {"name": "prognosis", "label": "پیش‌بینی (Prognosis)", "type": "textarea"},
        {"name": "treatment_plan", "label": "طرح درمان", "type": "textarea"},
    ]
}