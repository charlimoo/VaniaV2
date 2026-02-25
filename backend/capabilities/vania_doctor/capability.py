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
    ProfileService,
    ClinicalTestsService,
)
from vania_core.schemas import TherapyPhase
from vania_core.tests_catalog import TEST_CATALOG

# --- Form & Tooling Imports ---
from .forms import ALL_FORMS_LIST

# Configure Logger
logger = logging.getLogger(__name__)

@register_capability("vania_doctor")
class VaniaDoctorCapability(BaseCapability):

    def get_tools(self, user: Any, session_id: str) -> List[Any]:
        from .tools import VaniaDoctorToolFactory
        return VaniaDoctorToolFactory().get_tools(user, session_id)

    def get_context_prompt(self, user: Any, resource_id: str) -> str:
        """
        Dynamically generates treatment context and injects available forms.
        [FIX] Now includes HISTORY of previously filled forms.
        """
        if not resource_id:
            return ""

        try:
            patient = CustomUser.objects.get(pk=resource_id)
            doctor_id = int(user.id)
            roadmap = RoadmapService.get_or_create_roadmap(patient, doctor_id=doctor_id)

            # We look for the latest Base Profile form submission
            base_profile_entry = UserContextEntry.objects.filter(
                user=patient,
                definition__key__startswith="clinical_form_base_profile_v1",
                is_active=True
            ).order_by('-created_at').first()
            if base_profile_entry and int(base_profile_entry.data.get("submitted_by_doctor_id") or 0) != doctor_id:
                base_profile_entry = UserContextEntry.objects.filter(
                    user=patient,
                    definition__key__startswith="clinical_form_base_profile_v1",
                    is_active=True,
                ).order_by('-created_at')
                base_profile_entry = next(
                    (entry for entry in base_profile_entry if int(entry.data.get("submitted_by_doctor_id") or 0) == doctor_id),
                    None
                )

            demographics_context = ""
            if base_profile_entry:
                d = base_profile_entry.data
                # Build a string string summary for the AI
                demographics_context = f"""
**DEMOGRAPHICS (Source: Base Profile Form):**
- Age/Birth: {d.get('birth_date', 'N/A')}
- Job: {d.get('job_status', 'N/A')} ({d.get('job_title', '')})
- Education: {d.get('education_level', 'N/A')}
- Marital Status: {d.get('marital_status', 'N/A')}
- Family: {len(d.get('family_history', []))} recorded members.
"""
            else:
                demographics_context = "\n(No Base Profile Form recorded yet. Please fill 'BASE_PROFILE_V1' first.)\n"
                
            # --- 1. Base Context ---
            base_msg = f"""
### 🏥 ACTIVE CLINICAL CONTEXT
**Patient:** {patient.full_name} (ID: {patient.id})
**Current Phase:** {roadmap.current_phase.value}
**Guiding Doctor:** Dr. {user.full_name or user.phone_number}

{demographics_context}
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
                    if doctor_id and not entry.data.get("submitted_by_doctor_id"):
                        entry.data["submitted_by_doctor_id"] = doctor_id
                        entry.save(update_fields=["data"])
                    if int(entry.data.get("submitted_by_doctor_id") or 0) != doctor_id:
                        continue
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

            # --- 2.5 Inject Test History ---
            clinical_tests = ClinicalTestsService.get_tests(patient, doctor_id=doctor_id)
            if clinical_tests:
                base_msg += "\n### 🧪 PATIENT TEST HISTORY\n"
                for t in clinical_tests[:7]:
                    date_str = (t.get("created_at", "") or "")[:10]
                    base_msg += (
                        f"- TestID: {t.get('catalog_id') or '-'} | Title: {t.get('title')} | "
                        f"Date: {date_str} | HasFile: {'Yes' if t.get('file_name') else 'No'} | "
                        f"Summary: {t.get('result_summary', '')[:240]}\n"
                    )
            else:
                base_msg += "\n(No psychology tests have been prescribed/recorded yet.)\n"

            # --- 3. Inject Available Forms Context ---
            forms_context = "\n### 📋 AVAILABLE CLINICAL FORMS (Tools)\n"
            forms_context += "You can use the 'submit_clinical_form' tool to fill these:\n"
            for f in ALL_FORMS_LIST:
                # We provide the KEY so the agent knows what ID to pass to the tool
                forms_context += f"- ID: `{f['key']}` | Title: {f['title']} | Desc: {f['description']}\n"
            
            base_msg += forms_context

            tests_context = "\n### 🧪 AVAILABLE PSYCHOLOGY TESTS (Catalog)\n"
            tests_context += "Use `manage_clinical_tests` with catalog_id to prescribe tests:\n"
            for test in TEST_CATALOG:
                tests_context += f"- ID: `{test['id']}` | Title: {test['title']} | URL: {test['url']}\n"
            base_msg += tests_context

            # --- 4. Phase-Aware Guidance (Soft Policy / No Hard Gating) ---
            if roadmap.current_phase == TherapyPhase.PHASE_1_ANALYSIS:
                base_msg += """
⚠️ **ACTION REQUIRED: PHASE 1 (ANALYSIS)**
The patient is in the initial analysis phase.
1.  **ALWAYS fill BASE_PROFILE_V1 first** using `submit_clinical_form`.
2.  The doctor input may come from typed notes OR session voice transcription; treat both as valid clinical input.
3.  Fill additional clinical forms from available list when the data supports it.
4.  Write/update `clinical_summary` using `update_clinical_summary`.
5.  Prescribe 1 to 7 psychology tests via `manage_clinical_tests` (using catalog IDs).
"""
            elif roadmap.current_phase in [TherapyPhase.PHASE_2_APPROACHES, TherapyPhase.PHASE_3_SELECTION]:
                base_msg += """
⚠️ **ACTION REQUIRED: PHASE 2/3 (STRATEGY)**
The profile is complete. You should now propose treatment approaches.
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
                base_msg += """
⚠️ **ACTION REQUIRED: PHASE 4 (PROTOCOL DESIGN)**
The doctor has selected the approaches. You should now design the session protocols.
1.  **Action:** Generate a detailed, step-by-step execution guide for the upcoming sessions.
2.  **Tool:** Persist these plans by calling `manage_roadmap` with `action="ADD_SESSION"`.
"""
            elif roadmap.current_phase == TherapyPhase.PHASE_5_EXECUTION:
                base_msg += """
✅ **PHASE 5: EXECUTION**
Therapy plan is active. Guide the doctor through execution and finalize reports with tools when notes are provided.
"""

            # If a session is active, include operational details without enforcing phase gates.
            active_session = None
            if roadmap.active_session_number:
                active_session = next((s for s in roadmap.sessions if s.session_number == roadmap.active_session_number), None)

            if active_session:
                base_msg += f"""
### 🎯 ACTIVE SESSION
- Session: {active_session.session_number}
- Topic: {active_session.title}
- Status: ACTIVE / IN-PROGRESS
- Doctor Protocol: {active_session.doctor_instructions or "No specific protocol was generated. Proceed with standard clinical practice."}
- Your Role:
  1. Guide the doctor through the protocol steps.
  2. When the doctor provides notes, use `finalize_session_report`.
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
            doctor_id = int(user.id)
            
            # 1. Get Basic DB Info
            profile_data = {
                "id": patient.id,
                "name": patient.full_name or patient.phone_number,
                "phone": patient.phone_number,
                # Defaults
                "age": "N/A",
                "job": "N/A",
                "education": "N/A"
            }

            # 2. Overlay Data from Base Profile Form if exists
            base_profile_entry = UserContextEntry.objects.filter(
                user=patient,
                definition__key__startswith="clinical_form_base_profile_v1"
            ).order_by('-created_at').first()
            if base_profile_entry and int(base_profile_entry.data.get("submitted_by_doctor_id") or 0) != doctor_id:
                base_profile_entry = UserContextEntry.objects.filter(
                    user=patient,
                    definition__key__startswith="clinical_form_base_profile_v1"
                ).order_by('-created_at')
                base_profile_entry = next(
                    (entry for entry in base_profile_entry if int(entry.data.get("submitted_by_doctor_id") or 0) == doctor_id),
                    None
                )

            if base_profile_entry:
                d = base_profile_entry.data
                # Map Form Fields -> Profile UI Fields
                profile_data["name"] = d.get("full_name") or profile_data["name"]
                profile_data["age"] = d.get("birth_date") # Or calculate age from date
                profile_data["job"] = f"{d.get('job_status', '')} - {d.get('job_title', '')}"
                profile_data["education"] = d.get("education_level")
                profile_data["marital_status"] = d.get("marital_status")
                
                
            summary_text = ProfileService.get_summary(patient, doctor_id=doctor_id)
            demographics = ProfileService.get_demographics(patient, doctor_id=doctor_id)
            # 1. Roadmap Data
            roadmap = RoadmapService.get_or_create_roadmap(patient, doctor_id=doctor_id)
            
            # 2. Rescue Net (Tasks) Data
            tasks = TaskService.get_patient_tasks(patient, doctor_id=doctor_id)
            
            # 3. Thought Appendix Data
            appendix = AppendixService.get_library(patient, doctor_id=doctor_id)
            
            # 4. Session History
            history = SessionService.get_patient_history(patient, viewer_role='DOCTOR', doctor_id=doctor_id)
            
            summary_text = ProfileService.get_summary(patient, doctor_id=doctor_id)
            
            # 5. [FIX] Calculate Active Goals (Logic borrowed from PatientDataService)
            active_smart_goals = []
            forms_list = self._get_forms_history(patient, doctor_id=doctor_id)
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
                if doctor_id and not f.data.get("submitted_by_doctor_id"):
                    f.data["submitted_by_doctor_id"] = doctor_id
                    f.save(update_fields=["data"])
                if int(f.data.get("submitted_by_doctor_id") or 0) != doctor_id:
                    continue
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

            tests_history = ClinicalTestsService.get_tests(patient, doctor_id=doctor_id)
            forms_tests_analysis = ProfileService.get_forms_tests_analysis(patient, doctor_id=doctor_id)

            return {
                "is_active": True,
                "patient_profile": profile_data,
                "clinical_summary": summary_text,
                "forms_tests_analysis": forms_tests_analysis,
                "roadmap_data": roadmap.model_dump(),
                "appendix_data": appendix.model_dump(),
                "tasks": tasks, 
                "sessions": history, 
                "active_goals": active_smart_goals,
                # Forms
                "forms": forms_history, 
                "tests": tests_history,
                "tests_catalog": TEST_CATALOG,
                "available_forms": ALL_FORMS_LIST, 
                
                "active_tab": "PROFILE", 
                "ui_signal": None
            }
        except Exception as e:
            logger.error(f"❌ Hydration Failed: {e}")
            return None

    def _get_forms_history(self, patient, doctor_id=None):
        # Helper to fetch history
        entries = UserContextEntry.objects.filter(
            user=patient, 
            definition__key__startswith="clinical_form_"
        ).order_by('-created_at')
        
        history = []
        for f in entries:
            if doctor_id and not f.data.get("submitted_by_doctor_id"):
                f.data["submitted_by_doctor_id"] = int(doctor_id)
                f.save(update_fields=["data"])
            if doctor_id and int(f.data.get("submitted_by_doctor_id") or 0) != int(doctor_id):
                continue
            history.append({
                "id": str(f.id),
                "form_key": f.data.get('form_key'),
                "type": f.data.get('form_title', 'Unknown Form'),
                "date": f.created_at.isoformat(),
                "data": f.data 
            })
        return history
    
    def get_default_canvases(self) -> List[str]:
        return ["VANIA_PATIENT_MANAGER"]
