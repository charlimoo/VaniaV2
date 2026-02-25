# backend/capabilities/vania_doctor/handlers/form_handlers.py
import time
import logging
from capabilities.base import BaseFormHandler
from capabilities.registry import register_form_handler
from users.models import CustomUser, ContextDefinition, UserContextEntry
from users.services import user_context_manager

# [IMPORTANT] Adjusted import to point to the sibling 'forms' directory
from ..forms import ALL_FORMS_LIST

logger = logging.getLogger(__name__)

@register_form_handler
class MarriageAssessmentHandler(BaseFormHandler):
    """
    Handles Form No. 4 (Matchmaking / همسان‌گزینی).
    Logic: Calculates compatibility percentage based on scoring fields (0-5).
    """
    label = "Vania: Marriage Compatibility Calc"

    def process(self, user, data, session_id, resource_id=None) -> dict:
        if not resource_id:
            raise ValueError("A patient must be selected to submit this assessment.")

        try:
            patient = CustomUser.objects.get(pk=resource_id)
        except CustomUser.DoesNotExist:
            raise ValueError("The selected patient was not found.")

        # --- 1. Scoring Logic ---
        # Keys corresponding to the 0-5 scoring fields
        score_keys = [
            'score_age', 'score_education', 'score_job', 'score_income', 
            'score_living_status', 'score_appearance', 'score_military', 
            'score_demand', 'score_prev_marriage', 'score_housing', 
            'score_social_class', 'score_family_view', 'score_general_criteria', 
            'score_specific_criteria', 'score_expectations', 'score_health', 
            'score_mmpi', 'score_neo', 'score_other_tests', 'score_special_cond', 
            'score_religious', 'score_other_notes'
        ]

        total_score = 0
        # 22 items * max score of 5 = 110 (You can adjust this max if needed)
        max_possible_score = len(score_keys) * 5 

        for key in score_keys:
            val = data.get(key)
            if val is not None:
                try:
                    # Handle "3 - Medium" strings by taking the first char
                    if isinstance(val, str) and val[0].isdigit():
                        int_val = int(val.split()[0])
                    else:
                        int_val = int(val)
                    
                    if 0 <= int_val <= 5:
                        total_score += int_val
                except (ValueError, IndexError):
                    pass 

        compatibility_percent = 0.0
        if max_possible_score > 0:
            compatibility_percent = round((total_score / max_possible_score) * 100, 2)

        # --- 2. Persistence ---
        timestamp = int(time.time())
        context_key = f"clinical_form_marriage_v1_{timestamp}"
        
        ContextDefinition.objects.get_or_create(
            key=context_key,
            defaults={'description': "Matchmaking Assessment Result"}
        )

        final_data = {
            "form_key": "MATCHMAKING_V1",
            "form_title": "همسان‌گزینی",
            "submitted_by_doctor_id": user.id,
            "raw_scores": data,
            "calculated_total": total_score,
            "max_score": max_possible_score,
            "compatibility_percent": compatibility_percent,
            "interpretation": f"{compatibility_percent}% Compatibility"
        }

        entry = user_context_manager.add_entry(
            user=patient,
            key=context_key,
            data=final_data,
            source=UserContextEntry.SourceType.USER,
            creator=user
        )

        logger.info(f"Saved Matchmaking Form for Patient {patient.id}. Score: {compatibility_percent}%")

        return {
            "status": "success",
            "entry_id": entry.id,
            "total_score": total_score,
            "compatibility_percent": f"{compatibility_percent}%",
            "message": f"Assessment saved. Compatibility: {compatibility_percent}%"
        }


@register_form_handler
class GenericFormHandler(BaseFormHandler):
    """
    A universal handler for Vania's clinical forms.
    """
    label = "Vania: Generic Clinical Data"

    def process(self, user, data, session_id, resource_id=None) -> dict:
        if not resource_id:
            raise ValueError("A patient must be selected to submit this form.")

        try:
            patient = CustomUser.objects.get(pk=resource_id)
        except CustomUser.DoesNotExist:
            raise ValueError("The selected patient was not found.")

        # Identify the Form Definition
        incoming_key = data.get('form_key')
        form_def = next((f for f in ALL_FORMS_LIST if f['key'] == incoming_key), None)
        
        if form_def:
            final_title = form_def['title']
            final_key = form_def['key']
        else:
            final_key = incoming_key or "generic_clinical"
            final_title = data.get('form_title', final_key)

        timestamp = int(time.time())
        instance_key = f"clinical_form_{final_key.lower()}_{timestamp}"
        
        ContextDefinition.objects.get_or_create(
            key=instance_key,
            defaults={'description': f"Submission: {final_title}"}
        )

        final_data = {
            "handler": "GenericFormHandler",
            "submitted_by_doctor_id": user.id,
            "submission_timestamp": timestamp,
            "form_key": final_key,
            "form_title": final_title,
            **data
        }

        entry = user_context_manager.add_entry(
            user=patient,
            key=instance_key,
            data=final_data,
            source=UserContextEntry.SourceType.USER,
            creator=user
        )

        return {
            "status": "success",
            "entry_id": entry.id,
            "message": "Clinical form saved successfully."
        }