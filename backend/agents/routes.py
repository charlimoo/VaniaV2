import logging
import time
import os
import tempfile
import math
import uuid 
import json 
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from asgiref.sync import sync_to_async
from openai import OpenAI
from django.conf import settings

# --- Agno Imports ---
from agno.agent import AgentSession, Agent 
from ag_ui.core import RunAgentInput

# --- Project Imports ---
from agents.auth import get_current_user
from agents.factory import create_agent_for_service
from users.models import CustomUser
from billing.services import process_service_charge
from billing.models import BillingConfig

# --- Module Imports ---
from .schemas import SessionCreate, SessionUpdate
from .storage import get_storage, get_session_safe
from .stream import agui_stream_generator
from .utils import safe_serialize

from services.access_service import access_service
from services.models import AgentService, SharedLink 

from enum import Enum
class SessionType(str, Enum):
    AGENT = "agent"

# --- Logging Setup ---
logger = logging.getLogger(__name__)
router = APIRouter()

# ==========================================
# SESSION MANAGEMENT ROUTES
# ==========================================

@router.get("/sessions")
async def list_sessions(
    limit: int = Query(20, ge=1, le=100), 
    page: int = Query(1, ge=1), 
    user: CustomUser = Depends(get_current_user)
):
    """
    Lists chat sessions for the authenticated user.
    """
    request_id = int(time.time() * 1000)
    logger.info(f"📋 [ListSessions] [ReqID:{request_id}] Request received for User {user.id}")

    try:
        storage = get_storage()
        
        # Ensure table exists
        if hasattr(storage, 'create'): 
            await sync_to_async(storage.create)()

        # Fetch Sessions
        try:
            sessions = await sync_to_async(storage.get_sessions)(
                user_id=str(user.id), 
                session_type=SessionType.AGENT
            )
        except TypeError:
            sessions = await sync_to_async(storage.get_sessions)(user_id=str(user.id))
        
        # Sort & Paginate
        sessions.sort(key=lambda x: getattr(x, 'created_at', 0) or 0, reverse=True)
        
        start = (page - 1) * limit
        end = start + limit
        paginated = sessions[start:end] if start < len(sessions) else []
        
        # Serialize
        results = []
        for s in paginated:
            s_dict = safe_serialize(s)
            session_data = s_dict.get('session_data') or {}
            
            display_name = s.session_id
            agent_slug = s_dict.get('agent_id') 
            
            if session_data:
                display_name = session_data.get('name', display_name)
                if 'agent_id' in session_data:
                    agent_slug = session_data['agent_id']

            results.append({
                "session_id": s.session_id,
                "session_name": display_name,
                "agent_id": agent_slug,
                "created_at": s.created_at
            })
            
        return JSONResponse(content=results)

    except Exception as e:
        logger.error(f"❌ [ListSessions] Error: {e}", exc_info=True)
        return JSONResponse(content=[], status_code=200)


@router.get("/sessions/{session_id}")
async def get_session_history(
    session_id: str, 
    user: CustomUser = Depends(get_current_user)
):
    """
    Retrieves the full chat history and session metadata.
    """
    try:
        storage = get_storage()
        session = await sync_to_async(get_session_safe)(storage, session_id, str(user.id))
        
        session_name = "New Conversation"
        if session:
            s_data = safe_serialize(session)
            if 'session_data' in s_data:
                session_name = s_data['session_data'].get('name', "New Conversation")

        if not session: 
            return JSONResponse(content={
                "chat_history": [],
                "session_name": "گفتگوی جدید"
            })

        history = []
        raw_messages = []

        if hasattr(session, 'memory') and session.memory and hasattr(session.memory, 'messages'):
            raw_messages = session.memory.messages
        elif hasattr(session, 'messages'):
            raw_messages = session.messages
        else:
            s_dict = safe_serialize(session)
            if 'memory' in s_dict and 'messages' in s_dict['memory']:
                raw_messages = s_dict['memory']['messages']
            elif 'messages' in s_dict:
                raw_messages = s_dict['messages']

        if not raw_messages and hasattr(session, 'get_messages'):
            raw_messages = session.get_messages()

        for msg in raw_messages:
            m_data = safe_serialize(msg)
            if not isinstance(m_data, dict): continue
            
            role = m_data.get('role')
            if role == 'model': role = 'assistant'
            if role == 'function': role = 'tool'

            item = {
                "role": role,
                "content": m_data.get('content'),
                "created_at": m_data.get('created_at') or m_data.get('timestamp')
            }

            if role == 'assistant':
                item["tool_calls"] = m_data.get('tool_calls')
            
            if role == 'tool':
                item["tool_call_id"] = m_data.get('tool_call_id')
                if isinstance(item["content"], (dict, list)):
                    try:
                        import json
                        item["content"] = json.dumps(item["content"], ensure_ascii=False)
                    except:
                        item["content"] = str(item["content"])

            history.append(item)

        history.sort(key=lambda x: x.get('created_at') or 0)
        
        return JSONResponse(content={
            "chat_history": history,
            "session_name": session_name
        })
        
    except Exception as e:
        logger.error(f"❌ [GetHistory] Error processing {session_id}: {e}", exc_info=True)
        return JSONResponse(content={"chat_history": [], "session_name": "Error"}, status_code=200)


@router.post("/sessions")
async def create_session(
    session_data: SessionCreate, 
    user: CustomUser = Depends(get_current_user)
):
    """
    Creates a new session record in the DB manually.
    """
    logger.info(f"✨ [CreateSession] Creating '{session_data.session_name}' (ID: {session_data.session_id})")

    try:
        storage = get_storage()
        if hasattr(storage, 'create'): await sync_to_async(storage.create)()

        existing = await sync_to_async(get_session_safe)(storage, session_data.session_id, str(user.id))
        if existing: 
            return JSONResponse(content={"status": "exists"})

        now = int(time.time())
        new_session = AgentSession(
            session_id=session_data.session_id,
            user_id=str(user.id),
            session_data={
                "name": session_data.session_name,
                "agent_id": session_data.session_state.get("agent_id"),
                **session_data.session_state
            },
            created_at=now,
            updated_at=now
        )
        
        try: new_session.session_type = SessionType.AGENT
        except: pass

        if hasattr(storage, 'upsert_session'):
            await sync_to_async(storage.upsert_session)(session=new_session)
        else:
            await sync_to_async(storage.upsert)(session=new_session)
            
        return JSONResponse(content={"status": "created"})

    except Exception as e:
        logger.error(f"❌ [CreateSession] Error: {e}")
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


@router.patch("/sessions/{session_id}")
async def rename_session(
    session_id: str, 
    update_data: SessionUpdate, 
    user: CustomUser = Depends(get_current_user)
):
    try:
        storage = get_storage()
        session = await sync_to_async(get_session_safe)(storage, session_id, str(user.id))
        
        if session:
            if not session.session_data: session.session_data = {}
            session.session_data["name"] = update_data.session_name
            
            if hasattr(storage, 'upsert_session'):
                await sync_to_async(storage.upsert_session)(session=session)
            else:
                await sync_to_async(storage.upsert)(session=session)
            
            return JSONResponse(content={"status": "updated"})
        
        return JSONResponse(content={"status": "not_found"})
        
    except Exception as e:
        logger.error(f"❌ [RenameSession] Error: {e}")
        return JSONResponse(content={"status": "error"}, status_code=500)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str, 
    user: CustomUser = Depends(get_current_user)
):
    try:
        storage = get_storage()
        session = await sync_to_async(get_session_safe)(storage, session_id, str(user.id))
        
        if not session:
            return JSONResponse(content={"status": "not_found"}, status_code=404)

        if hasattr(storage, 'delete_session'):
            await sync_to_async(storage.delete_session)(session_id=session_id)
        elif hasattr(storage, 'delete'):
             await sync_to_async(storage.delete)(session_id=session_id)
        
        return JSONResponse(content={"status": "deleted"})
        
    except Exception as e:
        logger.error(f"❌ [DeleteSession] Error: {e}")
        return JSONResponse(content={"status": "error"}, status_code=500)


# ==========================================
# CANCEL RUN ENDPOINT
# ==========================================

@router.post("/runs/{run_id}/cancel")
async def cancel_run_endpoint(
    run_id: str, 
    user: CustomUser = Depends(get_current_user)
):
    """
    Explicitly cancels a run. 
    This updates the database state immediately, regardless of the stream status.
    """
    try:
        storage = get_storage()
        
        # 1. Verify ownership (Security)
        session = await sync_to_async(get_session_safe)(storage, run_id, str(user.id))
        
        # Fallback: Check if run_id is actually a session_id
        if not session:
             session = await sync_to_async(get_session_safe)(storage, run_id, str(user.id))
        
        if not session:
            raise HTTPException(status_code=404, detail="Run or Session not found")

        # 2. Perform Cancellation
        dummy_agent = Agent(storage=storage, session_id=run_id)
        
        await sync_to_async(dummy_agent.cancel_run)(run_id)
        
        logger.info(f"🛑 [CancelAPI] User {user.id} marked run {run_id} as cancelled.")
        return {"status": "cancelled"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [CancelAPI] Failed to cancel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# SHARING ENDPOINTS
# ==========================================

@router.post("/share/{session_id}")
async def create_share_link(
    session_id: str,
    user: CustomUser = Depends(get_current_user)
):
    """
    Generates a public read-only link for a specific session.
    """
    try:
        # 1. Verify Session Ownership
        storage = get_storage()
        session = await sync_to_async(get_session_safe)(storage, session_id, str(user.id))
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # 2. Extract Metadata
        s_data = safe_serialize(session)
        title = "Conversation"
        agent_slug = ""
        
        if 'session_data' in s_data:
            title = s_data['session_data'].get('name', title)
            agent_slug = s_data['session_data'].get('agent_id', agent_slug)

        # 3. Create or Get Link
        link, created = await SharedLink.objects.aget_or_create(
            session_id=session_id,
            created_by=user,
            defaults={
                "title": title,
                "agent_slug": agent_slug,
                "is_active": True
            }
        )
        
        return {
            "share_id": str(link.id),
            "url": f"/share/{link.id}" # Frontend path
        }

    except Exception as e:
        logger.error(f"❌ [Share] Creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create share link")


@router.get("/share/{token}")
async def get_shared_chat(token: str):
    """
    Public Endpoint: Returns sanitized chat history for a shared link.
    No Authentication required (Bypassed by Middleware).
    """
    try:
        # 1. Validate Token
        try:
            link = await SharedLink.objects.aget(id=token, is_active=True)
        except SharedLink.DoesNotExist:
            raise HTTPException(status_code=404, detail="Link not found or expired")

        # 2. Increment View Count
        @sync_to_async
        def increment_views(obj):
            obj.views_count += 1
            obj.save(update_fields=['views_count'])
        
        await increment_views(link)

        # 3. Fetch Session Data
        storage = get_storage()
        
        # Direct fetch, bypassing ownership check
        try:
            session = await sync_to_async(storage.get_session)(session_id=link.session_id, session_type=SessionType.AGENT)
        except TypeError:
            session = await sync_to_async(storage.get_session)(session_id=link.session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Original session deleted")

        # 4. Sanitize Messages
        history = []
        raw_messages = []

        if hasattr(session, 'memory') and session.memory and hasattr(session.memory, 'messages'):
            raw_messages = session.memory.messages
        elif hasattr(session, 'messages'):
            raw_messages = session.messages
        else:
            s_dict = safe_serialize(session)
            if 'memory' in s_dict and 'messages' in s_dict['memory']:
                raw_messages = s_dict['memory']['messages']
            elif 'messages' in s_dict:
                raw_messages = s_dict['messages']

        # [FIX] Fallback for Agno v2: use get_messages() if direct access fails
        if not raw_messages and hasattr(session, 'get_messages'):
            try:
                raw_messages = session.get_messages()
            except Exception as e:
                logger.warning(f"⚠️ [Share] Failed to call get_messages(): {e}")

        for msg in raw_messages:
            m_data = safe_serialize(msg)
            if not isinstance(m_data, dict): continue
            
            role = m_data.get('role')
            if role == 'model': role = 'assistant'
            if role == 'function': role = 'tool'
            
            # Skip system messages for public view
            if role == 'system': continue

            item = {
                "role": role,
                "content": m_data.get('content'),
                "created_at": m_data.get('created_at') or m_data.get('timestamp')
            }

            if role == 'assistant':
                item["tool_calls"] = m_data.get('tool_calls')
            
            if role == 'tool':
                item["tool_call_id"] = m_data.get('tool_call_id')
                content = item["content"]
                if isinstance(content, (dict, list)):
                    try: item["content"] = json.dumps(content, ensure_ascii=False)
                    except: item["content"] = str(content)

            history.append(item)

        history.sort(key=lambda x: x.get('created_at') or 0)

        return {
            "title": link.title,
            "agent_slug": link.agent_slug,
            "created_at": link.created_at,
            "chat_history": history
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [Share] Fetch failed: {e}")
        raise HTTPException(status_code=500, detail="Internal Error")


# ==========================================
# AG-UI STREAMING ENDPOINT
# ==========================================

@router.post("/agui")
async def agui_chat_endpoint(
    request: Request,
    input_data: RunAgentInput,
    agent_id: str = Query(..., description="Service Slug"),
    user: CustomUser = Depends(get_current_user)
):
    """
    Main entry point for Chat Streaming.
    Enforces Demo Limits before starting the agent.
    """
    from services.usage import demo_usage_service
    
    req_start = time.time()
    
    try:
        thread_id = input_data.thread_id or f"sess_{user.id}_{agent_id}"
        
        try:
            service = await AgentService.objects.aget(slug=agent_id)
        except AgentService.DoesNotExist:
            raise HTTPException(status_code=404, detail="Agent service not found")

        has_access, _ = await sync_to_async(access_service.check_permission)(user, agent_id)

        if not has_access:
            can_proceed, reason = await demo_usage_service.check_limits(user, service, thread_id)
            if not can_proceed:
                logger.warning(f"⛔ [AGUI] Access Denied for User {user.id} on {agent_id}: {reason}")
                raise HTTPException(status_code=403, detail=reason)

        agent = await sync_to_async(create_agent_for_service)(
            user, agent_id, thread_id, request=request
        )
        
        stream_gen = agui_stream_generator(agent, input_data, request, is_demo_user=not has_access)
        
        return StreamingResponse(
            stream_gen,
            media_type="text/event-stream"
        )

    except HTTPException:
        raise
    except Exception as e:
        duration = time.time() - req_start
        logger.error(f"❌ [AGUI] Endpoint Error (after {duration:.2f}s): {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Internal Server Error in Agent Runtime: {str(e)}"
        )
        
        
@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...), 
    user: CustomUser = Depends(get_current_user)
):
    """
    Receives audio blob, sends to OpenAI Whisper, calculates cost, 
    charges the user, and returns text.
    """
    tmp_path = None
    try:
        suffix = os.path.splitext(file.filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        api_key = getattr(settings, "OPENAI_API_KEY", os.getenv("OPENAI_API_KEY"))
        client = OpenAI(api_key=api_key)
        
        with open(tmp_path, "rb") as audio_file:
            transcript_response = client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file,
                language="fa",
                response_format="verbose_json", 
                prompt="the user is talking in Persian about trade and business"
            )
        
        text = transcript_response.text
        duration_seconds = getattr(transcript_response, 'duration', 0.0)
        
        config = await sync_to_async(BillingConfig.load)()
        cost_per_min = config.transcription_cost_per_minute
        
        duration_minutes = Decimal(duration_seconds) / Decimal(60)
        total_cost = duration_minutes * cost_per_min
        
        total_cost = max(total_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), Decimal("0.10"))

        charge_result = await sync_to_async(process_service_charge)(
            user=user,
            amount=total_cost,
            description=f"Transcription: {duration_seconds:.1f}s"
        )

        if not charge_result['success']:
            logger.warning(f"User {user.id} failed to pay for transcription. Cost: {total_cost}")
            raise HTTPException(
                status_code=402, 
                detail=f"اعتبار کافی نیست. هزینه تبدیل صوت: {total_cost} سرمایه گفت‌وگو."
            )

        return {
            "text": text,
            "duration": duration_seconds,
            "cost": float(total_cost)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [Transcribe] Error: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)