
# start of backend/services/views.py
# backend/services/views.py
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from agents.factory import _build_session_selection_context
from agents.profile_context import build_default_profile_context, get_session_data_for_profile_context
from agents.prompt_culture import get_shared_prompt_culture
from agents.storage import get_session_safe, get_storage
from capabilities.registry import CapabilityRegistry

from .models import AgentService
from .serializers import ServiceSerializer
from users.eligibility import is_user_eligible_for_agent

logger = logging.getLogger(__name__)

class ServiceListView(APIView):
    """
    Returns a list of all active Agent Services.
    Optimized to determine access status (LOCKED/OWNED) based on the user's
    active Subscription Plan without hitting the DB for every agent.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # 1. Fetch Agent Services with optimizations
        visible_services_qs = AgentService.objects.filter(
            is_active=True,
            is_public=True
        ).prefetch_related(
            'plans', 
            'suggestions', 
            # [FIX] Removed 'interaction_forms' as it no longer exists on the AgentService model.
            'canvas_configs__canvas' 
        ).distinct()
        visible_services = [
            service for service in visible_services_qs
            if is_user_eligible_for_agent(user, service)
        ]
        
        # 2. Extract User's Active Plan Context for Serializer logic
        active_plan_id = None
        plan_expires_at = None
        
        if hasattr(user, 'wallet') and user.wallet.active_plan_id:
            if user.wallet.is_plan_active:
                active_plan_id = user.wallet.active_plan_id
                plan_expires_at = user.wallet.plan_expires_at

        # 3. Serialize
        serializer_context = {
            'request': request,
            'user_active_plan_id': active_plan_id,
            'user_plan_expires_at': plan_expires_at
        }
        
        serializer = ServiceSerializer(visible_services, many=True, context=serializer_context)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ServiceDebugContextView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug: str):
        user = request.user
        service = AgentService.objects.filter(slug=slug, is_active=True, is_public=True).first()
        if not service:
            return Response({"detail": "Service not found."}, status=status.HTTP_404_NOT_FOUND)
        if not is_user_eligible_for_agent(user, service):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

        session_id = request.query_params.get("session_id") or ""
        resource_id = (
            request.headers.get("X-Target-Resource-ID")
            or request.query_params.get("resource_id")
            or request.query_params.get("visitor_id")
            or request.query_params.get("patient_id")
        )
        selected_doctor_id = (
            request.headers.get("X-Target-Expert-ID")
            or request.headers.get("X-Target-Doctor-ID")
            or request.query_params.get("expert_id")
            or request.query_params.get("doctor_id")
        )
        selected_case_id = request.headers.get("X-Target-Case-ID") or request.query_params.get("case_id")

        session_selection_text = ""
        session_data = None
        if session_id:
            try:
                storage = get_storage()
                session = get_session_safe(storage, session_id, str(user.id))
                session_data = getattr(session, "session_data", None) if session else None
                if not session_data and isinstance(session, dict):
                    session_data = session.get("session_data")
            except Exception as exc:
                logger.warning(f"⚠️ [Services] Debug session lookup failed for {session_id}: {exc}")
                session_data = None

        effective_session_data = dict(session_data or {})
        if resource_id and not effective_session_data.get("visitor_id") and not effective_session_data.get("patient_id"):
            effective_session_data["visitor_id"] = resource_id
            effective_session_data["patient_id"] = resource_id
        if selected_doctor_id and not effective_session_data.get("selected_expert_id") and not effective_session_data.get("selected_doctor_id"):
            effective_session_data["selected_expert_id"] = selected_doctor_id
            effective_session_data["selected_doctor_id"] = selected_doctor_id
        if selected_case_id and not effective_session_data.get("selected_case_id"):
            effective_session_data["selected_case_id"] = selected_case_id

        effective_session_data = get_session_data_for_profile_context(
            user,
            session_id,
            effective_session_data,
        )
        user_context_text = build_default_profile_context(
            user,
            session_id=session_id,
            session_data=effective_session_data,
        )

        session_selection_lines = _build_session_selection_context(effective_session_data)
        if session_selection_lines:
            session_selection_text = (
                "\n### ACTIVE FRONTEND SELECTIONS (System Injected)\n"
                + "\n".join([f"- {line}" for line in session_selection_lines])
            )

        capability_prompt = CapabilityRegistry.get_prompt_additions_for_domains(service.capabilities or [], user)
        resource_prompt = ""
        if resource_id:
            resource_prompt = CapabilityRegistry.get_context_prompt_for_domains(
                service.capabilities or [],
                user,
                str(resource_id),
            )

        return Response(
            {
                "service": {
                    "id": service.id,
                    "slug": service.slug,
                    "name": service.name,
                    "model_id": service.model_id,
                },
                "layers": {
                    "shared_prompt": get_shared_prompt_culture(),
                    "static_prompt": service.system_prompt or "",
                    "capability_prompt": capability_prompt or "",
                    "runtime_injected_context": "\n\n".join(
                        [part for part in [user_context_text, session_selection_text, resource_prompt] if part]
                    ),
                    "history_note": "Conversation/history tokens are estimated on the frontend from current thread messages.",
                },
                "sources": {
                    "capabilities": service.capabilities or [],
                    "resource_id": resource_id,
                    "selected_doctor_id": selected_doctor_id,
                    "selected_case_id": selected_case_id,
                    "session_id": session_id or None,
                },
            },
            status=status.HTTP_200_OK,
        )


class SubmitFormView(APIView):
    """
    Generic Endpoint for processing capability-defined forms.
    This replaces the old dynamic form builder with a code-first logic approach.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # [FIX] Robust extraction: Check 'handler', then 'form_handle' (legacy frontend), then nested definition
        handler_key = request.data.get('handler') or request.data.get('form_handle')
        
        if not handler_key:
            definition = request.data.get('definition')
            if isinstance(definition, dict):
                handler_key = definition.get('handler')

        session_id = request.data.get('session_id')
        form_data = request.data.get('data', {})
        
        # [FIX] Check Body for resource_id if header is missing
        resource_id = request.headers.get("X-Target-Resource-ID") or request.data.get("resource_id")

        if not handler_key:
            logger.warning(f"⚠️ [Forms] Submission failed. Payload keys: {list(request.data.keys())}")
            return Response({"error": "Missing 'handler' or 'form_handle' field in payload"}, status=status.HTTP_400_BAD_REQUEST)

        HandlerClass = CapabilityRegistry.get_handler(handler_key)
        
        if not HandlerClass:
            logger.warning(f"⚠️ [Forms] Handler '{handler_key}' not found in Registry.")
            return Response(
                {"error": f"Form handler '{handler_key}' not registered. Ensure the capability is loaded."}, 
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            logger.info(f"📝 [Forms] Executing handler: {handler_key} for User {request.user.id}")
            
            logic = HandlerClass()
            result = logic.process(
                user=request.user, 
                data=form_data, 
                session_id=session_id,
                resource_id=resource_id
            )
            
            return Response({
                "status": "success",
                "result": result
            }, status=status.HTTP_200_OK)

        except ValueError as ve:
            logger.warning(f"⚠️ [Forms] Validation failed: {ve}")
            return Response({"error": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"❌ [Forms] Execution failed for {handler_key}: {e}", exc_info=True)
            return Response(
                {"error": "Internal Error processing form logic."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
# end of backend/services/views.py
