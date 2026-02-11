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
from agents.context import resource_context 
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
def perform_hydration(agent_id: str, session_id: str, resource_id: str, user: CustomUser):
    """
    Executes the hydration logic synchronously (DB safe) and returns nothing.
    """
    try:
        service = AgentService.objects.get(slug=agent_id)
        if not service:
            return

        active_caps = service.capabilities or []
        target_keys = CapabilityRegistry.get_canvases_for_domains(active_caps)
        
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

# ==========================================
# 3. ENDPOINTS
# ==========================================

@router.get("/state/{session_id}", response_model=CanvasStateResponse)
async def get_canvas_state(
    session_id: str,
    request: Request,
    agent_id: str = Query(None, description="Service Slug"),
    patient_id: str = Query(None, description="Fallback Patient ID"),
    user: CustomUser = Depends(get_current_user)
):
    """
    Called by the Frontend on page load to hydrate the Canvas Store.
    """
    logger.info(f"🎨 [CanvasRoutes] Fetching state for Session: {session_id}")
    
    header_val = request.headers.get("X-Target-Resource-ID")
    logger.info(f"   [Debug] Header X-Target-Resource-ID: {header_val}")
    logger.info(f"   [Debug] Query patient_id: {patient_id}")
    
    resource_id = header_val
    if not resource_id and patient_id:
        resource_id = patient_id
        
    if resource_id:
        logger.info(f"   -> Context Resource ID Set: {resource_id}")
        token = resource_context.set(resource_id)
    
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

        if should_hydrate and agent_id:
            logger.info(f"🎨 [CanvasRoutes] Auto-hydration triggered for Agent: {agent_id}")
            try:
                # [FIX] Call the sync helper instead of running inline logic
                await perform_hydration(agent_id, session_id, resource_id, user)
                
                logger.info(f"✅ [CanvasRoutes] Hydration/Update complete.")
                canvases_data = await fetch_session_canvases(session_id)
                    
            except Exception as e:
                logger.error(f"❌ [CanvasRoutes] Auto-hydration failed: {e}", exc_info=True)

        return CanvasStateResponse(
            session_id=session_id,
            canvases=[CanvasDTO(**c) for c in canvases_data]
        )
    finally:
        if resource_id and 'token' in locals():
            resource_context.reset(token)

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
        
        if patient_id:
            try:
                patient = await CustomUser.objects.aget(pk=patient_id)
                
                # A. Permanent Summary Update
                if "clinical_summary" in delta:
                    await sync_to_async(ProfileService.update_summary)(patient, delta["clinical_summary"])
                
                # B. Permanent Demographics Update
                if "patient_profile" in delta:
                    await sync_to_async(ProfileService.update_demographics)(patient, delta["patient_profile"])
                    
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