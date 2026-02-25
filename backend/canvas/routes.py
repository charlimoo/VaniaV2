# start of backend/canvas/routes.py
# canvas/routes.py

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Query, Request
from pydantic import BaseModel
from asgiref.sync import sync_to_async

from agents.auth import get_current_user
from users.models import CustomUser
from services.models import AgentService
from services.models_canvas import CanvasInstance
from canvas.manager import canvas_manager
from agents.context import resource_context, selected_doctor_context
from vania_core.services import ProfileService 
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
def perform_hydration(agent_id: str, session_id: str, resource_id: str, selected_doctor_id: str, user: CustomUser):
    """
    Executes the hydration logic synchronously (DB safe) and returns nothing.
    """
    doctor_token = None
    try:
        logger.info(
            f"🧪 [CanvasRoutes] perform_hydration session={session_id} agent={agent_id} "
            f"user={user.id} resource_id={resource_id} selected_doctor_id={selected_doctor_id}"
        )
        if selected_doctor_id:
            doctor_token = selected_doctor_context.set(selected_doctor_id)
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
    logger.info(f"   [Debug] Header X-Target-Resource-ID: {header_val}")
    logger.info(f"   [Debug] Header X-Target-Doctor-ID: {header_doctor}")
    logger.info(f"   [Debug] Query patient_id: {patient_id}")
    logger.info(f"   [Debug] Query visitor_id: {visitor_id}")
    logger.info(f"   [Debug] Query doctor_id: {doctor_id}")
    logger.info(f"   [Debug] Query expert_id: {expert_id}")
    
    resource_id = header_val
    scoped_doctor_id = header_doctor
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
    
    try:
        canvases_data = await fetch_session_canvases(session_id)
        
        should_hydrate = not canvases_data
        
        if canvases_data and resource_id:
            pm_canvas = next((c for c in canvases_data if c['component_key'] == 'VANIA_PATIENT_MANAGER'), None)
            if pm_canvas:
                state = pm_canvas.get('current_state', {})
                if not state.get('is_active'):
                    logger.info("   -> Existing canvas is inactive/empty. Re-triggering hydration.")
                    should_hydrate = True
        if canvases_data and scoped_doctor_id:
            pj_canvas = next((c for c in canvases_data if c['component_key'] == 'VANIA_PATIENT_JOURNEY'), None)
            if pj_canvas:
                logger.info("   -> Doctor scope provided for patient journey. Forcing re-hydration.")
                should_hydrate = True

        if should_hydrate and agent_id:
            logger.info(f"🎨 [CanvasRoutes] Auto-hydration triggered for Agent: {agent_id}")
            try:
                # [FIX] Call the sync helper instead of running inline logic
                await perform_hydration(agent_id, session_id, resource_id, scoped_doctor_id, user)
                
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
        
        # 1. Identify the patient linked to this session
        # (This relies on the fact that Vania doctor sessions are mapped to 1 patient)
        # We get the patient_id from the context set by middleware
        patient_id = resource_context.get()
        selected_doctor_id = selected_doctor_context.get()
        
        if patient_id:
            try:
                patient = await CustomUser.objects.aget(pk=patient_id)
                
                # A. Permanent Summary Update
                if "clinical_summary" in delta:
                    await sync_to_async(ProfileService.update_summary)(patient, delta["clinical_summary"], int(selected_doctor_id) if selected_doctor_id else None)
                
                # B. Permanent Demographics Update
                if "patient_profile" in delta:
                    await sync_to_async(ProfileService.update_demographics)(patient, delta["patient_profile"], int(selected_doctor_id) if selected_doctor_id else None)

                # C. Permanent Forms+Tests Clinical Analysis
                if "forms_tests_analysis" in delta:
                    await sync_to_async(ProfileService.update_forms_tests_analysis)(patient, delta["forms_tests_analysis"], int(selected_doctor_id) if selected_doctor_id else None)
                    
            except CustomUser.DoesNotExist:
                pass

        # 2. Standard Canvas State Update (for the current session)
        result = await sync_to_async(canvas_manager.update_canvas_state)(
            canvas_id=instance_id,
            patch_data=delta,
            operation="merge"
        )
        return {"status": "success", "new_state": result["new_state"]}
    
    except Exception as e:
        logger.error(f"❌ [CanvasRoutes] Sync Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Sync Error")
# end of backend/canvas/routes.py
