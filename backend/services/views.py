
# start of backend/services/views.py
# backend/services/views.py
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import AgentService
from .serializers import ServiceSerializer
from capabilities.registry import CapabilityRegistry

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
        visible_services = AgentService.objects.filter(
            is_active=True,
            is_public=True
        ).prefetch_related(
            'plans', 
            'suggestions', 
            # [FIX] Removed 'interaction_forms' as it no longer exists on the AgentService model.
            'canvas_configs__canvas' 
        ).distinct()
        
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