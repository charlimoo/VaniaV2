# backend/agents/factory.py
import logging
import time
import json
from typing import List, Any, Optional
from django.conf import settings
from django.db import transaction

# --- Agno Imports ---
from agno.db.postgres import PostgresDb
from agno.db.sqlite import SqliteDb
from agno.knowledge.knowledge import Knowledge
from agno.vectordb.qdrant import Qdrant
from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.models.openai import OpenAIChat

# --- Service Imports ---
from services.models import AgentService
from services.tool_factory import ToolFactory
from services.rag_service import get_sanitized_table_name, get_session_knowledge, session_knowledge_exists
from services.models_canvas import CanvasType, CanvasInstance
from services.access_service import access_service
from core.ai_provider import get_agno_openai_kwargs
from users.roles import is_expert
from vania_core.profile_snapshots import (
    format_expert_profile_context,
    format_visitor_profile_context,
)

# --- Capability System ---
from capabilities.registry import CapabilityRegistry

# --- Context ---
from .context import resource_context

# --- Agent Import ---
from .service_agent import ServiceAgent
from .session_metadata import apply_session_metadata_defaults, get_session_knowledge_flag, set_session_knowledge_metadata
from .session_summary import TimedSessionSummaryManager
from fastapi import Request

# Configure Logger
logger = logging.getLogger(__name__)

# [CONFIG] Native Reasoning Models
NATIVE_REASONING_MODELS = {
    "o1", "o1-mini", "o1-preview", "o3-mini",
    "gpt-5", "gpt-5-mini", "gpt-5-nano",
    "deepseek-r1", "deepseek-reasoner"
}

NONE_EFFORT_MODELS = {"gpt-5.1", "gpt-5.2", "gpt5.1", "gpt5.2", "gpt-5", "gpt5"}


def create_agent_for_service(user, service_slug: str, session_id: str, request: Optional[Request] = None ) -> ServiceAgent:
    """
    Modular Factory: Instantiates a ServiceAgent by aggregating tools, instructions, 
    and UI states from code-defined Capabilities.
    """
    start_time = time.time()
    logger.info(f"🏭 [Factory] Starting creation of agent '{service_slug}' for User {user.id}")

    # =========================================================================
    # 1. Fetch Service Configuration & Determine Access
    # =========================================================================
    try:
        # [FIX] Removed 'interaction_forms' from prefetch_related
        service = AgentService.objects.prefetch_related(
            'knowledge_bases', 
            'custom_tools'
        ).get(slug=service_slug, is_active=True)
    except AgentService.DoesNotExist:
        logger.error(f"❌ [Factory] Service '{service_slug}' not found or is inactive.")
        raise ValueError(f"Service '{service_slug}' not found.")
    
    # Access & Model Swapping Logic
    has_access, _ = access_service.check_permission(user, service.slug)
    is_demo_mode = not has_access
    
    target_model_id = service.model_id 
    is_swapped_model = False 

    if is_demo_mode:
        demo_conf = service.demo_config or {}
        if demo_conf.get("model_override"):
            target_model_id = demo_conf["model_override"]
            is_swapped_model = True
            logger.info(f"🎭 [Factory] Demo Mode active for User {user.id}. Swapped model to: {target_model_id}")

    active_caps = service.capabilities or []
    
    # Retrieve the Scoped Context ID (e.g. Patient ID) set by Middleware
    resource_id = resource_context.get()

    # =========================================================================
    # 2. Canvas & Capability Hydration (UI State Pre-loading)
    # =========================================================================
    try:
        target_canvas_keys = CapabilityRegistry.get_canvases_for_domains(active_caps)
        
        if target_canvas_keys:
            with transaction.atomic():
                for key in target_canvas_keys:
                    try:
                        ctype = CanvasType.objects.get(component_key=key)
                        
                        # [CHANGED] Removed "if resource_id:" check.
                        # We allow capabilities to provide state even without a specific resource ID
                        # (e.g. The Patient Capability uses the logged-in 'user' as the resource).
                        start_state = CapabilityRegistry.get_initial_state_for_domains(
                            active_caps, user, session_id, resource_id, canvas_key=key
                        )
                        
                        # Fallback to the Canvas Definition's default state
                        final_state = start_state if start_state else ctype.default_state

                        CanvasInstance.objects.get_or_create(
                            session_id=session_id,
                            canvas_def=ctype,
                            defaults={
                                'current_state': final_state,
                                'is_visible': True
                            }
                        )
                    except CanvasType.DoesNotExist:
                        logger.warning(f"⚠️ [Factory] Canvas definition '{key}' missing in DB. Run sync_definitions.")
    except Exception as e:
        logger.warning(f"⚠️ [Factory] Canvas hydration failed: {e}")

    # =========================================================================
    # 3. Tool Injection
    # =========================================================================
    agent_tools = ToolFactory.get_all_tools(service, user)
    
    if active_caps:
        dynamic_tools = CapabilityRegistry.get_tools_for_domains(
            domains=active_caps,
            user=user,
            session_id=session_id
        )
        agent_tools.extend(dynamic_tools)
        logger.info(f"   [Factory] 🔌 Injected tools for: {active_caps}")

    # =========================================================================
    # 4. Prompt Engineering & Instructions
    # =========================================================================
    dynamic_instructions = []
    
    # A. User Context
    try:
        u_real_name = getattr(user, 'full_name', None)
        u_phone = getattr(user, 'phone_number', 'User')
        user_display_name = u_real_name if u_real_name else u_phone
        
        user_context_prompt = [f"User Name: {user_display_name}", f"User Phone: {u_phone}"]
        user_context_prompt.extend(format_expert_profile_context(user))
        if not is_expert(user):
            user_context_prompt.extend(format_visitor_profile_context(user))
        if user_context_prompt:
            context_block = "\n### USER CONTEXT (System Injected)\n" + "\n".join([f"- {line}" for line in user_context_prompt])
            dynamic_instructions.append(context_block)
            
    except Exception as e:
        logger.warning(f"⚠️ [Factory] Failed to inject user context: {e}")
        
    # B. Capability General Instructions
    cap_instructions = CapabilityRegistry.get_prompt_additions_for_domains(active_caps, user)
    if cap_instructions:
        dynamic_instructions.append(cap_instructions)

    # C. [HOOK] Resource-Specific Context Injection
    # If a Resource ID is locked, ask capabilities for context (e.g. "Active Patient: Ali")
    if resource_id:
        logger.info(f"   [Factory] 🔒 Context Locked to Resource: {resource_id}")
        resource_prompt = CapabilityRegistry.get_context_prompt_for_domains(
            active_caps, user, resource_id
        )
        if resource_prompt:
            dynamic_instructions.append(resource_prompt)
            logger.debug(f"   [Factory] Injected Resource Context ({len(resource_prompt)} chars)")

    # =========================================================================
    # 5. Hybrid Reasoning & Model Sanitization
    # =========================================================================
    model_id_lower = (target_model_id or "gpt-4o").lower()
    is_native_reasoning = any(m in model_id_lower for m in NATIVE_REASONING_MODELS)
    
    llm_kwargs = {"id": target_model_id, **get_agno_openai_kwargs()}
    
    user_effort_override = request.headers.get("x-reasoning-effort") if request else None
    user_reasoning_override = request.headers.get("x-enable-reasoning") if request else None

    final_effort = user_effort_override or service.reasoning_effort
    
    if is_native_reasoning:
        if final_effort and final_effort != 'default':
            if final_effort == 'none':
                if model_id_lower in NONE_EFFORT_MODELS:
                    llm_kwargs["reasoning_effort"] = "none"
            else:
                llm_kwargs["reasoning_effort"] = final_effort.lower()
    
    use_agno_reasoning_wrapper = False 
    if not is_native_reasoning and not is_swapped_model:
        final_enable_reasoning = (user_reasoning_override == 'true') if user_reasoning_override is not None else service.enable_reasoning
        if final_enable_reasoning:
            use_agno_reasoning_wrapper = True

    llm_model = OpenAIChat(**llm_kwargs)

    # =========================================================================
    # 6. Storage Engine
    # =========================================================================
    if "sqlite" in settings.DATABASE_CONNECTION_STRING:
        storage_instance = SqliteDb(
            db_file=settings.DATABASE_CONNECTION_STRING.replace("sqlite:///", ""),
            session_table="agent_sessions"
        )
    else:
        storage_instance = PostgresDb(
            db_url=settings.DATABASE_CONNECTION_STRING,
            session_table="agent_sessions"
        )

    # =========================================================================
    # 7. Knowledge Base (RAG)
    # =========================================================================
    agent_knowledge = None
    has_session_knowledge = False
    try:
        session = get_session_safe(storage_instance, session_id, str(user.id))
    except Exception as e:
        session = None
        logger.warning(f"⚠️ [Factory] Session lookup failed for {session_id}: {e}")

    if session:
        knowledge_flag = get_session_knowledge_flag(session)
        apply_session_metadata_defaults(session)
        if knowledge_flag is None:
            try:
                has_session_knowledge = session_knowledge_exists(session_id)
                set_session_knowledge_metadata(session, has_session_knowledge, 1 if has_session_knowledge else 0)
                if hasattr(storage_instance, "upsert_session"):
                    storage_instance.upsert_session(session=session)
                else:
                    storage_instance.upsert(session=session)
            except Exception as e:
                logger.warning(f"⚠️ [Factory] Session knowledge backfill failed for {session_id}: {e}")
        else:
            has_session_knowledge = knowledge_flag

    if has_session_knowledge:
        try:
            agent_knowledge = get_session_knowledge(session_id)
            dynamic_instructions.append(
                "### ATTACHED FILE KNOWLEDGE (System Injected)\n"
                "If the user asks about an uploaded or attached file in this thread, you must use the "
                "`search_knowledge_base` tool before answering."
            )
        except Exception as e:
            logger.error(f"❌ [Factory] Session knowledge initialization failed: {e}")
    else:
        kb = service.knowledge_bases.first()
        if kb:
            try:
                table_name = get_sanitized_table_name(kb.name)
                vector_db = Qdrant(
                    collection=table_name,
                    url=settings.QDRANT_URL,
                    api_key=settings.QDRANT_API_KEY,
                    embedder=OpenAIEmbedder(id="text-embedding-3-small", **get_agno_openai_kwargs()),
                )
                agent_knowledge = Knowledge(vector_db=vector_db)
            except Exception as e:
                logger.error(f"❌ [Factory] Knowledge initialization failed: {e}")

    # =========================================================================
    # 7.5 Session Summary Manager
    # =========================================================================
    summary_manager = None
    if getattr(service, 'enable_session_summaries', False):
        summary_manager = TimedSessionSummaryManager(
            model=OpenAIChat(id="gpt-4o-mini", **get_agno_openai_kwargs()),
            log_prefix=f"[Run {session_id}]",
        )
        logger.debug(f"   [Factory] 🧠 Session Summaries enabled for {session_id}")

    # =========================================================================
    # 8. ServiceAgent Instantiation
    # =========================================================================
    agent_instance = ServiceAgent(
        user=user,
        service_config=service,
        session_id=session_id,
        
        # LLM & Tools
        model=llm_model,
        storage=storage_instance, 
        tools=agent_tools,
        
        # Intelligence
        knowledge=agent_knowledge,
        search_knowledge=True if agent_knowledge else False,
        reasoning=use_agno_reasoning_wrapper,
        
        # Session Summaries
        session_summary_manager=summary_manager,
        
        # System Meta
        add_datetime_to_context=True,
        timezone_identifier="Asia/Tehran",
        
        # Prompts
        extra_instructions="\n".join(dynamic_instructions)
    )

    elapsed = time.time() - start_time
    logger.info(f"✅ [Factory] Agent '{service.name}' built in {elapsed:.4f}s. Model: {target_model_id} (Swapped: {is_swapped_model})")
    
    return agent_instance
