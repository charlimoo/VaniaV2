FORM_FAMILY = {
    "key": "FAMILY_V1",
    "title": "فرم شماره ۲: مشاوره خانواده",
    "description": "بررسی پویایی سیستم خانواده و مقایسه دیدگاه زوجین.",
    "handler": "GenericFormHandler",
    "schema": [
        {"name": "complaint_main", "label": "شکایت اصلی", "type": "textarea", "width": "full"},
        
        # --- Comparative Table (Simulated via Layout) ---
        
        # 1. Personality
        {"name": "view_personality_husband", "label": "ویژگی‌های شخصیتی (نظر آقا)", "type": "textarea", "width": "half"},
        {"name": "view_personality_wife", "label": "ویژگی‌های شخصیتی (نظر خانم)", "type": "textarea", "width": "half"},
        
        # 2. Communication
        {"name": "view_comm_husband", "label": "مهارت‌های ارتباطی (نظر آقا)", "type": "textarea", "width": "half"},
        {"name": "view_comm_wife", "label": "مهارت‌های ارتباطی (نظر خانم)", "type": "textarea", "width": "half"},
        
        # 3. Conflict
        {"name": "view_conflict_husband", "label": "حل تعارض (نظر آقا)", "type": "textarea", "width": "half"},
        {"name": "view_conflict_wife", "label": "حل تعارض (نظر خانم)", "type": "textarea", "width": "half"},
        
        # 4. Financial
        {"name": "view_financial_husband", "label": "موضوعات مالی (نظر آقا)", "type": "textarea", "width": "half"},
        {"name": "view_financial_wife", "label": "موضوعات مالی (نظر خانم)", "type": "textarea", "width": "half"},
        
        # 5. Sexual
        {"name": "view_sexual_husband", "label": "روابط زناشویی (نظر آقا)", "type": "textarea", "width": "half"},
        {"name": "view_sexual_wife", "label": "روابط زناشویی (نظر خانم)", "type": "textarea", "width": "half"},

        # 6. Parenting
        {"name": "view_parent_husband", "label": "تربیت فرزند (نظر آقا)", "type": "textarea", "width": "half"},
        {"name": "view_parent_wife", "label": "تربیت فرزند (نظر خانم)", "type": "textarea", "width": "half"},

        # 7. In-laws
        {"name": "view_inlaws_husband", "label": "ارتباط با بستگان (نظر آقا)", "type": "textarea", "width": "half"},
        {"name": "view_inlaws_wife", "label": "ارتباط با بستگان (نظر خانم)", "type": "textarea", "width": "half"},

        # --- Analysis ---
        {"name": "systemic_diagnosis", "label": "تشخیص سیستم معیوب خانواده", "type": "textarea", "width": "full"},
        {"name": "intervention_plan", "label": "طرح درمان", "type": "textarea", "width": "full"},
    ]
}