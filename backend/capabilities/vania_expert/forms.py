# backend/capabilities/vania_doctor/forms.py
import time
import logging
from capabilities.base import BaseFormHandler
from capabilities.registry import register_form_handler
from users.models import CustomUser, ContextDefinition, UserContextEntry
from users.services import user_context_manager
from .forms import ALL_FORMS_LIST
logger = logging.getLogger(__name__)

@register_form_handler
class MarriageAssessmentHandler(BaseFormHandler):
    """
    Handles Form No. 3 (Marriage Counseling / مشاوره ازدواج).
    
    Logic:
    1. Extracts scoring fields (scale 0-4) from the submission.
    2. Calculates the total raw score.
    3. Computes compatibility percentage based on the formula: (Total / 130) * 100.
    4. Saves the result to the patient's context history.
    """
    label = "Vania: Marriage Compatibility Calc"

    def process(self, user, data, session_id, resource_id=None) -> dict:
        """
        Processes the scoring logic for the pre-marital assessment.
        """
        if not resource_id:
            raise ValueError("A patient must be selected to submit this assessment.")

        try:
            patient = CustomUser.objects.get(pk=resource_id)
        except CustomUser.DoesNotExist:
            raise ValueError("The selected patient was not found.")

        # --- 1. Scoring Logic ---
        # List of keys corresponding to the 0-4 scoring fields in the schema
        score_keys = [
            'score_age', 
            'score_education', 
            'score_job', 
            'score_income', 
            'score_military', 
            'score_acquaintance_mode', 
            'score_acquaintance_duration',
            'score_marriage_history', 
            'score_housing', 
            'score_social_class',
            'score_cultural_class', 
            'score_economic_class', 
            'score_family_opinion',
            'score_education_view', 
            'score_job_view', 
            'score_genetic_history',
            'score_health_history', 
            'score_mental_history', 
            'score_divorce_history',
            'score_addiction_history', 
            'score_criminal_history', 
            'score_knowledge',
            'score_test_results', 
            'score_belief_alignment', 
            'score_criteria_alignment',
            'score_expectations'
        ]

        total_score = 0
        # The PDF indicates a denominator of 130 for the calculation
        max_possible_score = 130 

        for key in score_keys:
            val = data.get(key)
            if val is not None:
                try:
                    # Some frontends might send "3 - High", so we extract the first digit
                    if isinstance(val, str) and val[0].isdigit():
                        int_val = int(val[0])
                    else:
                        int_val = int(val)
                    
                    # Ensure range 0-4
                    if 0 <= int_val <= 4:
                        total_score += int_val
                except (ValueError, IndexError):
                    pass # Ignore invalid inputs, treat as 0

        # Calculate Percentage
        compatibility_percent = 0.0
        if max_possible_score > 0:
            compatibility_percent = round((total_score / max_possible_score) * 100, 2)

        # --- 2. Context Persistence ---
        # Generate a unique key for this specific submission
        timestamp = int(time.time())
        context_key = f"clinical_form_marriage_v1_{timestamp}"
        
        # Ensure the definition exists in the system
        ContextDefinition.objects.get_or_create(
            key=context_key,
            defaults={'description': "Marriage Counseling Assessment Result"}
        )

        # Prepare final data payload
        final_data = {
            "form_key": "MARRIAGE_V1",
            "form_title": "مشاوره ازدواج",
            "submitted_by_doctor_id": user.id,
            "raw_scores": data, # Keep original inputs
            "calculated_total": total_score,
            "max_score": max_possible_score,
            "compatibility_percent": compatibility_percent,
            "interpretation": f"{compatibility_percent}% Match"
        }

        # Save to Patient History
        entry = user_context_manager.add_entry(
            user=patient,
            key=context_key,
            data=final_data,
            source=UserContextEntry.SourceType.USER,
            creator=user
        )

        logger.info(f"Saved Marriage Assessment for Patient {patient.id}. Score: {compatibility_percent}%")

        return {
            "status": "success",
            "entry_id": entry.id,
            "total_score": total_score,
            "compatibility_percent": f"{compatibility_percent}%",
            "message": f"Assessment saved. Calculated Compatibility: {compatibility_percent}%"
        }


@register_form_handler
class GenericFormHandler(BaseFormHandler):
    """
    A universal handler for Vania's clinical forms.
    Now looks up the definition to save human-readable titles.
    """
    label = "Vania: Generic Clinical Data"

    def process(self, user, data, session_id, resource_id=None) -> dict:
        if not resource_id:
            raise ValueError("A patient must be selected to submit this form.")

        try:
            patient = CustomUser.objects.get(pk=resource_id)
        except CustomUser.DoesNotExist:
            raise ValueError("The selected patient was not found.")

        # --- [FIX] 1. Identify the Form Definition ---
        # We look for the 'form_key' in the submitted data (e.g. "SOCIAL_V1")
        incoming_key = data.get('form_key')
        
        # Find the definition in our master list
        form_def = next((f for f in ALL_FORMS_LIST if f['key'] == incoming_key), None)
        
        if form_def:
            # Found it! Use the official Title and Key
            final_title = form_def['title']
            final_key = form_def['key']
            description = f"Submission: {final_title}"
        else:
            # Fallback if key is missing or unknown
            final_key = incoming_key or "generic_clinical"
            final_title = data.get('form_title', final_key)
            description = f"Clinical Form Submission: {final_key}"

        # --- 2. Context Persistence ---
        timestamp = int(time.time())
        # We create a unique key for this specific entry in the DB
        # e.g. clinical_form_social_v1_1700000000
        instance_key = f"clinical_form_{final_key.lower()}_{timestamp}"
        
        ContextDefinition.objects.get_or_create(
            key=instance_key,
            defaults={'description': description}
        )

        final_data = {
            "handler": "GenericFormHandler",
            "submitted_by_doctor_id": user.id,
            "submission_timestamp": timestamp,
            "form_key": final_key,    # [IMPORTANT] Used by frontend to map field labels
            "form_title": final_title, # [IMPORTANT] Used for the header
            **data
        }

        entry = user_context_manager.add_entry(
            user=patient,
            key=instance_key,
            data=final_data,
            source=UserContextEntry.SourceType.USER, # Marked as USER since doctor filled it manually
            creator=user
        )

        logger.info(f"Saved Form '{final_title}' for Patient {patient.id}.")

        return {
            "status": "success",
            "entry_id": entry.id,
            "message": "Clinical form saved successfully."
        }