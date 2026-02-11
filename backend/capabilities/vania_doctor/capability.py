# backend/capabilities/vania_doctor/capability.py
import logging
import json # [ADDED]
from typing import List, Any, Dict, Optional
from asgiref.sync import sync_to_async

# --- Capability System Imports ---
from capabilities.base import BaseCapability
from capabilities.registry import register_capability

# --- Vania Core & User Imports ---
from users.models import CustomUser, UserContextEntry
from vania_core.services import (
    RoadmapService, 
    AppendixService, 
    SessionService, 
    TaskService,
    ProfileService
)
from vania_core.schemas import TherapyPhase

# --- Form & Tooling Imports ---
from .form_definitions import ALL_FORMS_LIST

# Configure Logger
logger = logging.getLogger(__name__)

@register_capability("vania_doctor")
class VaniaDoctorCapability(BaseCapability):

    def get_tools(self, user: Any, session_id: str) -> List[Any]:
        from .tools import VaniaDoctorToolFactory
        return VaniaDoctorToolFactory().get_tools(user, session_id)

    def get_context_prompt(self, user: Any, resource_id: str) -> str:
        """
        Dynamically generates phase-aware instructions AND injects available forms.
        [FIX] Now includes HISTORY of previously filled forms.
        """
        if not resource_id:
            return ""

        try:
            patient = CustomUser.objects.get(pk=resource_id)
            roadmap = RoadmapService.get_or_create_roadmap(patient)
            
            # --- 1. Base Context ---
            base_msg = f"""
### 🏥 ACTIVE CLINICAL CONTEXT
**Patient:** {patient.full_name} (ID: {patient.id})
**Current Phase:** {roadmap.current_phase.value}
**Guiding Doctor:** Dr. {user.full_name or user.phone_number}
"""

            # --- [FIX] 2. Inject Past Forms History (Perception) ---
            # Fetch last 5 filled forms to give the agent context
            recent_forms = UserContextEntry.objects.filter(
                user=patient,
                definition__key__startswith="clinical_form_",
                is_active=True
            ).order_by('-created_at')[:5]

            if recent_forms.exists():
                base_msg += "\n### 🗂️ PATIENT CLINICAL HISTORY (Filled Forms)\n"
                for entry in recent_forms:
                    # Extract title and date
                    form_title = entry.data.get('form_title', entry.definition.key)
                    date_str = entry.created_at.strftime('%Y-%m-%d')
                    
                    # Convert raw JSON data to a summarized string (ignoring nulls)
                    # We flatten it to save tokens
                    summary_data = {k: v for k, v in entry.data.items() 
                                    if v and k not in ['handler', 'submitted_by_doctor_id', 'form_key']}
                    
                    base_msg += f"- **{form_title}** ({date_str}): {json.dumps(summary_data, ensure_ascii=False)}\n"
            else:
                base_msg += "\n(No clinical forms have been filled for this patient yet.)\n"


            # --- 3. Inject Available Forms Context ---
            forms_context = "\n### 📋 AVAILABLE CLINICAL FORMS (Tools)\n"
            forms_context += "You can use the 'submit_clinical_form' tool to fill these:\n"
            for f in ALL_FORMS_LIST:
                # We provide the KEY so the agent knows what ID to pass to the tool
                forms_context += f"- ID: `{f['key']}` | Title: {f['title']} | Desc: {f['description']}\n"
            
            base_msg += forms_context

            # --- 3. Phase-Specific Instructions ---

            # PHASE 1: Initial Analysis
            if roadmap.current_phase == TherapyPhase.PHASE_1_ANALYSIS:
                return base_msg + """
⚠️ **ACTION REQUIRED: PHASE 1 (ANALYSIS)**
The patient is in the initial analysis phase.
1.  **Goal:** Generate the "Integrated Psychological Profile".
2.  **Check:** Confirm if Projective Tests (TAT/Rorschach) have been provided.
3.  **Action:** If not, ask the doctor to provide them to you.
"""

            # PHASE 2 & 3: Strategy and Planning
            elif roadmap.current_phase in [TherapyPhase.PHASE_2_APPROACHES, TherapyPhase.PHASE_3_SELECTION]:
                return base_msg + """
⚠️ **ACTION REQUIRED: PHASE 2/3 (STRATEGY)**
The profile is complete. You must now propose treatment approaches.
A.  **Action:** choose 3 strategy from the list below (or suggest one if you think something else suits the case perfectly):

1.بر اساس ویژگی ها
2. رویکرد شناختی
3. رویکرد رفتاری
4. رویکرد انسان‌گرایانه
5. رویکرد دیالکتیکی
6. رویکرد شناختی-رفتاری (CBT)
7. رویکرد پذیرش و تعهد (ACT)
8. رویکرد ذهن‌آگاهی
9. رویکرد شفقت‌درمانی
10. رویکرد طرحواره‌درمانی
11. رویکرد درمانی عقلانی-هیجانی (REBT)
12. رویکرد واقعیت درمانی
13. رویکرد تحلیلی
14. رویکرد فلسفی
15. رویکرد اجتماعی
16. هرمنوتیک انتقادی
17. تحلیل و درمان یونگی
18. رویکرد هیجان‌مدار
19. گشتالت درمانی
20. رویکرد اگزیستانسیالیستی
21. رویکرد برنامه‌ریزی عصبی (NLP)
22. درمان وجودی
23. رویکرد زوج درمانی
24. رویکرد خانواده درمانی
26. درمان مبتنی بر تحلیل ارتباط محاوره‌ای
27. درمان ساختاری
28. خانواده درمانی استراتژیک
29. رویکرد سیستمی
30. روایت درمانی
31. درمان فرا نسلی
32. رابطه درمانی
33. آموزش روانی
34. مشاوره رابطه
35. رویکرد عصب‌شناسی
36. رویکرد روان‌شناسی مثبت‌گرایی
37. رویکرد ادلری
38. رویکرد سلامت
39. رویکرد روان درمانی کوتاه مدت
40. رویکرد مدیریت سازمانی-شغلی
41. رویکرد سیستماتیک
42. نظریه دو عاملی هرزبرگ 
48. نظریه تقویت 
49. نظریه تعامل فرد-سازمان
50. نظریه انگیزش خود تعیینی 
51. نظریه تعادل کار و زندگی
52. رویکرد نقل قول‌گرایی
53. رویکرد مواجهه درمانی
54. رویکرد فرایندگرا
55. رویکرد تلفیقی
56. رویکرد مهارت‌های زندگی
57. رویکرد گلاسر (نظریه انتخاب)
58. رویکرد واقعیت‌گرایی
59. رویکرد ساختارگرایی
60. رویکرد روان‌تحلیلی
61. رویکرد بازی‌درمانی
62. رویکرد معناگرایی
63. رویکرد حرکتی متمرکز
64. رویکرد ساختار شخصیتی
65. رویکرد تحلیل شناختی
66. رویکرد عمقی
67. رویکرد تحلیل بین فردی
68. رویکرد روان درمانی اتوژنیک
69. رویکرد تعاملی (TA)
70. رویکرد حمایتی
71. درمان شخص محور (راجرز)
72. رویکرد موسیقی‌درمانی
73. رویکرد هنر‌درمانی
74. رویکرد حرکت‌درمانی
75. رویکرد ورزش‌درمانی
76. رویکرد ماساژ‌درمانی
77. رویکرد نوروفیدبک
78. رویکرد بیوفیدبک
79. رویکرد آروماتراپی
80. رویکرد بازتاب‌شناسی
81. رویکرد روانشناسی فرهنگی
82. رویکرد بین‌فرهنگی
83. رویکرد چندفرهنگی
84. رویکرد درمانی بومی
85. رویکرد روان‌دارو‌درمانی
86. رویکرد زیست‌شناختی
87. رویکرد روانشناسی تربیتی
88. رویکرد درمان طبیعت‌مدار
89. رویکرد واقعیت مجازی در درمان
90. رویکرد درمان‌های دیجیتال
91. رویکرد طب سوزنی
92. رویکرد گیاه‌درمانی
93. رویکرد درمان نقشه‌ذهنی
94. رویکرد رفتاردرمانی افراطی
95. رویکرد رفتاردرمانی احتقانی
96. رویکرد روانشناسی اجتماعی
97. رویکرد رفتار سازمانی
98. رویکرد تحلیل شبکه‌ای
99. رویکرد تئاتردرمانی
100. رویکرد سینمادرمانی
101.  رویکرد  استاپ (STAP) 

B.  **Output:** Propose a comprehensive list of 17 recommendations (10 Modern, 5 Hybrid, 2 Integrative) with strong clinical rationales based on the patient's specific profile.
"""
            elif roadmap.current_phase == TherapyPhase.PHASE_4_PROTOCOL:
                return base_msg + """
⚠️ **ACTION REQUIRED: PHASE 4 (PROTOCOL DESIGN)**
The doctor has selected the approaches. You must now design the session protocols.
1.  **Action:** Generate a detailed, step-by-step execution guide for the upcoming sessions.
2.  **Tool:** Persist these plans by calling `manage_roadmap` with `action="ADD_SESSION"`.
"""

            # PHASE 5: Active Session Execution
            elif roadmap.current_phase == TherapyPhase.PHASE_5_EXECUTION:
                active_session = None
                if roadmap.active_session_number:
                    active_session = next((s for s in roadmap.sessions if s.session_number == roadmap.active_session_number), None)

                if active_session:
                    return base_msg + f"""
⚡ **ACTION REQUIRED: EXECUTE SESSION {active_session.session_number}**
**Topic:** {active_session.title}
**Status:** ACTIVE / IN-PROGRESS

**CONFIDENTIAL PROTOCOL FOR DOCTOR:**
{active_session.doctor_instructions or "No specific protocol was generated. Proceed with standard clinical practice."}

**YOUR ROLE:**
1.  Guide the doctor through the protocol steps.
2.  When the doctor provides notes, use `finalize_session_report`.
"""
                else:
                    return base_msg + """
✅ **PHASE 5: EXECUTION (IDLE)**
Therapy plan is active. You are awaiting the doctor to start a specific session from the Roadmap.
"""
            
            return base_msg

        except CustomUser.DoesNotExist:
            return "### SYSTEM ERROR: The selected patient ID was not found."
        except Exception as e:
            logger.error(f"Failed to generate context: {e}")
            return f"### SYSTEM ERROR: Could not load patient context. Details: {e}"

    def get_initial_canvas_state(
        self, 
        user: Any, 
        session_id: str, 
        resource_id: str,
        canvas_key: str
    ) -> Optional[Dict[str, Any]]:
        
        if canvas_key != "VANIA_PATIENT_MANAGER": return None
        if not resource_id: return None 

        try:
            patient = CustomUser.objects.get(pk=resource_id)
            summary_text = ProfileService.get_summary(patient)
            demographics = ProfileService.get_demographics(patient)
            # 1. Roadmap Data
            roadmap = RoadmapService.get_or_create_roadmap(patient)
            
            # 2. Rescue Net (Tasks) Data
            tasks = TaskService.get_patient_tasks(patient)
            
            # 3. Thought Appendix Data
            appendix = AppendixService.get_library(patient)
            
            # 4. Session History
            history = SessionService.get_patient_history(patient, viewer_role='DOCTOR')
            
            summary_text = ProfileService.get_summary(patient)
            
            # 5. [FIX] Calculate Active Goals (Logic borrowed from PatientDataService)
            active_smart_goals = []
            
            # We iterate through the roadmap sessions to find the latest completed one
            # Note: Roadmap sessions are stored in order (1, 2, 3...)
            # We check in reverse to find the latest.
            for session in reversed(roadmap.sessions):
                if session.status == "COMPLETED" and session.doc_id:
                    try:
                        # Fetch the actual log entry to get the JSON payload
                        log_entry = UserContextEntry.objects.filter(pk=session.doc_id).first()
                        if log_entry and isinstance(log_entry.data, dict):
                            # Handle both raw dict storage or stringified JSON
                            raw_summary = log_entry.data.get("summary", "")
                            doc_data = {}
                            
                            if isinstance(raw_summary, str) and raw_summary.strip().startswith("{"):
                                try:
                                    doc_data = json.loads(raw_summary)
                                except:
                                    pass
                            elif isinstance(raw_summary, dict):
                                doc_data = raw_summary
                                
                            # Extract goals if found
                            if doc_data.get("smart_goals"):
                                active_smart_goals = doc_data.get("smart_goals")
                                break # Stop at the most recent session
                    except Exception as e:
                        logger.warning(f"Failed to parse goals for session {session.doc_id}: {e}")

            # 6. Fetch Completed Forms History
            form_entries = UserContextEntry.objects.filter(
                user=patient, 
                definition__key__startswith="clinical_form_"
            ).order_by('-created_at')

            forms_history = []
            for f in form_entries:
                # Ideally, the form key is stored in data. If not, derive from definition key.
                # e.g. definition key "clinical_form_psychology_v1_123456" -> we want "PSYCHOLOGY_V1" if possible
                # But usually 'form_key' is saved in data by our handlers.
                stored_key = f.data.get('form_key')
                
                # Fallback title
                title = f.data.get('form_title', f.definition.key.replace('clinical_form_', ''))
                
                forms_history.append({
                    "id": str(f.id),
                    "form_key": stored_key, # [IMPORTANT] Send this so frontend can lookup schema
                    "type": title,          # Display title (fallback)
                    "date": f.created_at.isoformat(),
                    "data": f.data 
                })

            return {
                "is_active": True,
                "patient_profile": {
                    "id": patient.id,
                    "name": patient.full_name or patient.phone_number,
                    "phone": patient.phone_number,
                    **demographics
                },
                "clinical_summary": summary_text,
                "roadmap_data": roadmap.model_dump(),
                "appendix_data": appendix.model_dump(),
                "tasks": tasks, 
                "sessions": history, 
                "active_goals": active_smart_goals,
                # Forms
                "forms": forms_history, 
                "available_forms": ALL_FORMS_LIST, 
                
                "active_tab": "PROFILE", 
                "ui_signal": None
            }
        except Exception as e:
            logger.error(f"❌ Hydration Failed: {e}")
            return None

    def get_default_canvases(self) -> List[str]:
        return ["VANIA_PATIENT_MANAGER"]
