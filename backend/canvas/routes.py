# start of backend/canvas/routes.py
# canvas/routes.py

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from asgiref.sync import sync_to_async

from agents.auth import get_current_user
from users.models import CustomUser
from services.models import AgentService
from services.models_canvas import CanvasInstance
from canvas.manager import canvas_manager
from agents.context import resource_context, selected_doctor_context, selected_case_context
from vania_core.services import ProfileService 
from vania_core.case_service import CaseService
from vania_core.medication_service import MedicationService
from users.roles import is_expert
# [FIX] Import Registry to use in sync helper
from agents.factory import CapabilityRegistry, CanvasType

logger = logging.getLogger(__name__)
router = APIRouter()

# ... (Models remain same) ...
class CanvasDTO(BaseModel):
    id: str
    name: str
    slug: str
    component_key: str
    current_state: Dict[str, Any]
    is_visible: bool

class CanvasStateResponse(BaseModel):
    session_id: str
    canvases: List[CanvasDTO]

class UpdateCanvasRequest(BaseModel):
    delta: Dict[str, Any]

@sync_to_async
def fetch_session_canvases(session_id: str) -> List[Dict[str, Any]]:
    try:
        instances = CanvasInstance.objects.filter(
            session_id=session_id
        ).select_related('canvas_def').order_by('created_at')
        results = []
        for inst in instances:
            results.append({
                "id": str(inst.id),
                "name": inst.canvas_def.name,
                "slug": inst.canvas_def.slug,
                "component_key": inst.canvas_def.component_key,
                "current_state": inst.current_state,
                "is_visible": inst.is_visible
            })
        return results
    except Exception as e:
        logger.error(f"❌ [CanvasRoutes] Error fetching canvases: {e}")
        return []

@sync_to_async
def get_instance_for_update(instance_id: str, user_id: int) -> Optional[CanvasInstance]:
    try:
        return CanvasInstance.objects.get(id=instance_id)
    except CanvasInstance.DoesNotExist:
        return None

# [FIX] New Sync Helper for Hydration Logic
@sync_to_async
def perform_hydration(agent_id: str, session_id: str, resource_id: str, selected_doctor_id: str, selected_case_id: str, user: CustomUser):
    """
    Executes the hydration logic synchronously (DB safe) and returns nothing.
    """
    doctor_token = None
    case_token = None
    try:
        logger.info(
            f"🧪 [CanvasRoutes] perform_hydration session={session_id} agent={agent_id} "
            f"user={user.id} resource_id={resource_id} selected_doctor_id={selected_doctor_id}"
        )
        if selected_doctor_id:
            doctor_token = selected_doctor_context.set(selected_doctor_id)
        if selected_case_id:
            case_token = selected_case_context.set(selected_case_id)
        service = AgentService.objects.get(slug=agent_id)
        if not service:
            return

        active_caps = service.capabilities or []
        target_keys = CapabilityRegistry.get_canvases_for_domains(active_caps)
        logger.info(f"🧪 [CanvasRoutes] Hydration target canvases: {target_keys}")
        
        for key in target_keys:
            try:
                ctype = CanvasType.objects.get(component_key=key)
                
                # [CHANGED] Removed "if resource_id:" check.
                # We always ask the Capability for state. 
                # If it requires a resource_id and none is provided, the Capability itself returns None.
                # If it targets the logged-in user (like Vania Patient), it returns data.
                start_state = CapabilityRegistry.get_initial_state_for_domains(
                    active_caps, user, session_id, resource_id, canvas_key=key
                )
                if key == "VANIA_PATIENT_JOURNEY" and isinstance(start_state, dict):
                    logger.info(
                        "🧪 [CanvasRoutes] PJ start_state "
                        f"selected_doctor_id={start_state.get('selected_doctor_id')} "
                        f"tasks={len(start_state.get('tasks', []))} "
                        f"timeline={len(start_state.get('timeline', []))} "
                        f"tests={len(start_state.get('tests', []))}"
                    )
                
                if start_state:
                    # print(f"   -> Hydration State Generated for {key}") # Optional logging
                    pass

                # If start_state is None (capability didn't provide one), fallback to default
                final_state = start_state if start_state else ctype.default_state
                
                # Use update_or_create to ensure we don't duplicate or fail on existing rows
                CanvasInstance.objects.update_or_create(
                    session_id=session_id,
                    canvas_def=ctype,
                    defaults={
                        'current_state': final_state,
                        'is_visible': True
                    }
                )
            except CanvasType.DoesNotExist:
                pass
                
    except Exception as e:
        logger.error(f"❌ [CanvasRoutes] Hydration Helper Error: {e}")
        raise e
    finally:
        if doctor_token:
            selected_doctor_context.reset(doctor_token)
        if case_token:
            selected_case_context.reset(case_token)

# ==========================================
# 3. ENDPOINTS
# ==========================================

@router.get("/state/{session_id}", response_model=CanvasStateResponse)
async def get_canvas_state(
    session_id: str,
    request: Request,
    agent_id: str = Query(None, description="Service Slug"),
    patient_id: str = Query(None, description="Fallback Patient ID"),
    doctor_id: str = Query(None, description="Fallback Doctor ID"),
    visitor_id: str = Query(None, description="Fallback Visitor ID"),
    expert_id: str = Query(None, description="Fallback Expert ID"),
    user: CustomUser = Depends(get_current_user)
):
    """
    Called by the Frontend on page load to hydrate the Canvas Store.
    """
    logger.info(f"🎨 [CanvasRoutes] Fetching state for Session: {session_id}")
    
    header_val = request.headers.get("X-Target-Resource-ID")
    header_doctor = request.headers.get("X-Target-Expert-ID") or request.headers.get("X-Target-Doctor-ID")
    header_case = request.headers.get("X-Target-Case-ID")
    logger.info(f"   [Debug] Header X-Target-Resource-ID: {header_val}")
    logger.info(f"   [Debug] Header X-Target-Doctor-ID: {header_doctor}")
    logger.info(f"   [Debug] Header X-Target-Case-ID: {header_case}")
    logger.info(f"   [Debug] Query patient_id: {patient_id}")
    logger.info(f"   [Debug] Query visitor_id: {visitor_id}")
    logger.info(f"   [Debug] Query doctor_id: {doctor_id}")
    logger.info(f"   [Debug] Query expert_id: {expert_id}")
    
    resource_id = header_val
    scoped_doctor_id = header_doctor
    scoped_case_id = header_case or request.query_params.get("case_id")
    if not resource_id and (visitor_id or patient_id):
        resource_id = visitor_id or patient_id
    if not scoped_doctor_id and (expert_id or doctor_id):
        scoped_doctor_id = expert_id or doctor_id
        
    if resource_id:
        logger.info(f"   -> Context Resource ID Set: {resource_id}")
        token = resource_context.set(resource_id)
    if scoped_doctor_id:
        logger.info(f"   -> Context Doctor ID Set: {scoped_doctor_id}")
        doctor_token = selected_doctor_context.set(scoped_doctor_id)
    if scoped_case_id:
        logger.info(f"   -> Context Case ID Set: {scoped_case_id}")
        case_token = selected_case_context.set(scoped_case_id)
    
    try:
        canvases_data = await fetch_session_canvases(session_id)
        
        should_hydrate = not canvases_data
        
        if canvases_data and resource_id:
            pm_canvas = next((c for c in canvases_data if c['component_key'] == 'VANIA_PATIENT_MANAGER'), None)
            if pm_canvas:
                state = pm_canvas.get('current_state', {})
                selected_case_payload = state.get("selected_case") if isinstance(state.get("selected_case"), dict) else None
                if not state.get('is_active'):
                    logger.info("   -> Existing canvas is inactive/empty. Re-triggering hydration.")
                    should_hydrate = True
                elif scoped_case_id and state.get("selected_case_id") != scoped_case_id:
                    logger.info("   -> Case scope changed for patient manager. Re-triggering hydration.")
                    should_hydrate = True
                elif scoped_case_id and (
                    not selected_case_payload or selected_case_payload.get("id") != scoped_case_id
                ):
                    logger.info("   -> Patient manager selected_case payload is stale. Re-triggering hydration.")
                    should_hydrate = True
        if canvases_data:
            pj_canvas = next((c for c in canvases_data if c['component_key'] == 'VANIA_PATIENT_JOURNEY'), None)
            if pj_canvas:
                state = pj_canvas.get("current_state", {}) or {}
                cases = state.get("cases") or []
                selected_case_payload = state.get("selected_case") if isinstance(state.get("selected_case"), dict) else None
                if not state.get("is_active") or not isinstance(cases, list) or len(cases) == 0:
                    logger.info("   -> Patient journey canvas is empty/inactive. Re-triggering hydration.")
                    should_hydrate = True
                elif scoped_doctor_id and state.get("selected_doctor_id") != int(scoped_doctor_id):
                    logger.info("   -> Doctor scope provided for patient journey. Forcing re-hydration.")
                    should_hydrate = True
                elif scoped_case_id and state.get("selected_case_id") != scoped_case_id:
                    logger.info("   -> Case scope changed for patient journey. Re-triggering hydration.")
                    should_hydrate = True
                elif scoped_case_id and (
                    not selected_case_payload or selected_case_payload.get("id") != scoped_case_id
                ):
                    logger.info("   -> Patient journey selected_case payload is stale. Re-triggering hydration.")
                    should_hydrate = True

        if should_hydrate and agent_id:
            logger.info(f"🎨 [CanvasRoutes] Auto-hydration triggered for Agent: {agent_id}")
            try:
                # [FIX] Call the sync helper instead of running inline logic
                await perform_hydration(agent_id, session_id, resource_id, scoped_doctor_id, scoped_case_id, user)
                
                logger.info(f"✅ [CanvasRoutes] Hydration/Update complete.")
                canvases_data = await fetch_session_canvases(session_id)
                pj_canvas = next((c for c in canvases_data if c.get("component_key") == "VANIA_PATIENT_JOURNEY"), None)
                if pj_canvas:
                    s = pj_canvas.get("current_state", {}) or {}
                    logger.info(
                        "🧪 [CanvasRoutes] PJ after hydration "
                        f"selected_doctor_id={s.get('selected_doctor_id')} "
                        f"tasks={len(s.get('tasks', []))} "
                        f"timeline={len(s.get('timeline', []))} "
                        f"tests={len(s.get('tests', []))}"
                    )
                    
            except Exception as e:
                logger.error(f"❌ [CanvasRoutes] Auto-hydration failed: {e}", exc_info=True)

        return CanvasStateResponse(
            session_id=session_id,
            canvases=[CanvasDTO(**c) for c in canvases_data]
        )
    finally:
        if resource_id and 'token' in locals():
            resource_context.reset(token)
        if scoped_doctor_id and 'doctor_token' in locals():
            selected_doctor_context.reset(doctor_token)
        if scoped_case_id and 'case_token' in locals():
            selected_case_context.reset(case_token)

@router.patch("/instance/{instance_id}")
async def update_canvas_instance(
    instance_id: str,
    payload: UpdateCanvasRequest,
    user: CustomUser = Depends(get_current_user)
):
    try:
        logger.info(f"✏️ [CanvasRoutes] User updating Canvas {instance_id}")
        instance = await get_instance_for_update(instance_id, user.id)
        if not instance:
            raise HTTPException(status_code=404, detail="Canvas not found.")

        # --- [FIX] PERMANENT PERSISTENCE HOOK ---
        # If the frontend is sending profile or summary updates, 
        # we save them to the permanent DB tables, not just the canvas JSON.
        
        delta = payload.delta
        selected_case_delta = delta.get("selected_case") if isinstance(delta.get("selected_case"), dict) else {}
        
        # 1. Identify the patient linked to this session
        # (This relies on the fact that Vania doctor sessions are mapped to 1 patient)
        # We get the patient_id from the context set by middleware
        patient_id = resource_context.get()
        selected_doctor_id = selected_doctor_context.get()
        selected_case_id = selected_case_context.get()
        if "selected_doctor_id" in delta:
            raw_doctor_id = delta.get("selected_doctor_id")
            selected_doctor_id = None if raw_doctor_id is None else str(raw_doctor_id)
        elif "doctor_id" in selected_case_delta:
            raw_doctor_id = selected_case_delta.get("doctor_id")
            selected_doctor_id = None if raw_doctor_id is None else str(raw_doctor_id)

        if "selected_case_id" in delta:
            raw_case_id = delta.get("selected_case_id")
            selected_case_id = None if raw_case_id is None else str(raw_case_id)
        elif "id" in selected_case_delta:
            raw_case_id = selected_case_delta.get("id")
            selected_case_id = None if raw_case_id is None else str(raw_case_id)
        
        if patient_id:
            try:
                patient = await CustomUser.objects.aget(pk=patient_id)
                user_is_expert = await sync_to_async(is_expert)(user)
                resolved_doctor_scope = int(selected_doctor_id) if selected_doctor_id else None

                # Draft cases created from the expert canvas do not always carry an
                # explicit doctor scope on the first PATCH. In that case, treat the
                # current expert as the owner so the draft case list can be persisted
                # before we enforce case-level edit permissions.
                if resolved_doctor_scope is None and user_is_expert:
                    resolved_doctor_scope = int(user.id)

                if "cases" in delta and resolved_doctor_scope:
                    await sync_to_async(CaseService.save_cases)(
                        patient,
                        resolved_doctor_scope,
                        delta["cases"],
                        creator=user,
                    )

                if user_is_expert and selected_case_id:
                    case_item = await sync_to_async(CaseService.get_accessible_case_for_expert)(patient, user, selected_case_id)
                    if case_item:
                        owner_doctor_id = case_item.get("doctor_id")
                        if owner_doctor_id:
                            resolved_doctor_scope = int(owner_doctor_id)
                    can_edit = bool(case_item and case_item.get("can_edit"))
                    if not can_edit:
                        raise HTTPException(status_code=403, detail="This case is read-only for you.")
                
                # A. Permanent Summary Update
                clinical_summary = delta.get("clinical_summary", selected_case_delta.get("clinical_summary"))
                if clinical_summary is not None:
                    await sync_to_async(ProfileService.update_summary)(patient, clinical_summary, resolved_doctor_scope, selected_case_id)
                
                # B. Permanent Demographics Update
                if "patient_profile" in delta:
                    await sync_to_async(ProfileService.update_demographics)(patient, delta["patient_profile"], resolved_doctor_scope)

                # C. Permanent Forms+Tests Clinical Analysis
                analysis_text = delta.get("forms_tests_analysis", selected_case_delta.get("forms_tests_analysis"))
                if analysis_text is not None:
                    await sync_to_async(ProfileService.update_forms_tests_analysis)(patient, analysis_text, resolved_doctor_scope, selected_case_id)
                medication_items = delta.get("medications", selected_case_delta.get("medications"))
                if medication_items is not None and selected_case_id:
                    await sync_to_async(MedicationService.save_plan)(
                        patient,
                        medication_items,
                        user,
                        resolved_doctor_scope,
                        selected_case_id,
                    )
                    
            except CustomUser.DoesNotExist:
                pass

        # 2. Standard Canvas State Update (for the current session)
        result = await sync_to_async(canvas_manager.update_canvas_state)(
            canvas_id=instance_id,
            patch_data=delta,
            operation="merge"
        )
        return {"status": "success", "new_state": result["new_state"]}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [CanvasRoutes] Sync Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Sync Error")
# end of backend/canvas/routes.py
