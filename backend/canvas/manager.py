# canvas/manager.py
import logging
import time
import json
from typing import Dict, Any, Callable
from django.db import transaction, OperationalError
from services.models_canvas import CanvasInstance, AgentCanvasConfig

logger = logging.getLogger(__name__)

# ==========================================
# 1. STATE MERGING LOGIC
# ==========================================

def deep_merge(target: Any, updates: Any) -> Any:
    """
    Recursively merges 'updates' into 'target'.
    - Dictionaries are merged key-by-key.
    - Arrays are overwritten (not appended) to avoid infinite growth on re-renders.
    - Primitives are overwritten.
    """
    if not isinstance(target, dict) or not isinstance(updates, dict):
        return updates
    
    for key, value in updates.items():
        if key in target:
            # If both are dicts, recurse
            if isinstance(target[key], dict) and isinstance(value, dict):
                target[key] = deep_merge(target[key], value)
            else:
                # Overwrite arrays/primitives
                target[key] = value
        else:
            # New key
            target[key] = value
    return target

# ==========================================
# 2. CONTEXT SUMMARIZERS (Token Optimized)
# ==========================================


# ==========================================
# 3. CANVAS MANAGER CLASS
# ==========================================

class CanvasManager:
    """
    Synchronous Controller for Canvas State Persistence.
    Handles DB locking, state merging, and context generation.
    """

    def ensure_canvases_for_session(self, session_id: str, agent_id: int) -> None:
        """
        Idempotent check to ensure default canvases exist for a session.
        """
        logger.debug(f"🎨 [Manager] Checking default canvases for Session: {session_id}")
        try:
            configs = AgentCanvasConfig.objects.filter(
                agent_id=agent_id, 
                is_default_open=True
            ).select_related('canvas')

            for config in configs:
                obj, created = CanvasInstance.objects.get_or_create(
                    session_id=session_id,
                    canvas_def=config.canvas,
                    defaults={
                        'current_state': config.canvas.default_state,
                        'is_visible': True
                    }
                )
                if created:
                    logger.info(f"   -> Created default canvas: {config.canvas.name}")
        except Exception as e:
            logger.error(f"❌ [Manager] Failed to ensure canvases: {e}")

    def update_canvas_state(self, canvas_id: str, patch_data: Dict[str, Any], operation: str = "merge") -> Dict[str, Any]:
        """
        Applies an update to the canvas state with transactional safety.
        Includes retry logic for Database locks.
        """
        logger.info(f"🎨 [Manager] Update Request: {canvas_id} | Op: {operation}")
        
        if not isinstance(patch_data, dict):
            logger.error(f"❌ [Manager] Invalid payload type: {type(patch_data)}")
            raise ValueError(f"Invalid input: 'data' must be a JSON Object.")

        max_retries = 5
        attempt = 0
        
        while attempt < max_retries:
            try:
                with transaction.atomic():
                    # Lock row to prevent race conditions (User typing vs Agent generating)
                    # logger.debug(f"   [Manager] Acquiring DB Lock...")
                    instance = CanvasInstance.objects.select_for_update().get(id=canvas_id)
                    # logger.debug(f"   [Manager] Lock acquired.")
                    
                    if not isinstance(instance.current_state, dict):
                        instance.current_state = {}

                    old_state = instance.current_state
                    new_state = old_state.copy()

                    if operation == "replace":
                        new_state = patch_data
                    elif operation == "merge":
                        new_state = deep_merge(new_state, patch_data)
                    
                    instance.current_state = new_state
                    instance.save()
                    
                    # Calculate keys changed for logging
                    old_keys = set(old_state.keys())
                    new_keys = set(new_state.keys())
                    
                    logger.info(f"✅ [Manager] Update Committed. Keys: {list(old_keys)} -> {list(new_keys)}")
                    
                    return {
                        "canvas_id": str(instance.id),
                        "canvas_name": instance.canvas_def.name,
                        "component_key": instance.canvas_def.component_key,
                        "slug": instance.canvas_def.slug,
                        "new_state": new_state
                    }
            
            except OperationalError as e:
                if "locked" in str(e).lower():
                    attempt += 1
                    wait_time = 0.2 * attempt 
                    logger.warning(f"⚠️ [Manager] DB Locked. Retrying {attempt}/{max_retries} in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"❌ [Manager] Operational Error: {e}")
                    raise e
            except CanvasInstance.DoesNotExist:
                logger.error(f"❌ [Manager] Canvas {canvas_id} NOT FOUND.")
                raise ValueError(f"Canvas ID {canvas_id} not found.")
            except Exception as e:
                logger.error(f"❌ [Manager] Unexpected Update Error: {e}")
                raise e
        
        raise Exception(f"Failed to update canvas {canvas_id} after {max_retries} attempts.")

# Singleton Instance
canvas_manager = CanvasManager()