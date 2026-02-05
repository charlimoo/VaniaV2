import logging
from agents.context import target_patient_context, user_context

logger = logging.getLogger(__name__)

class VaniaContextMiddleware:
    """
    Django Middleware to extract Vania headers and set context vars.
    This ensures Views (like Form Submit) have access to the same context as Agents.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Reset tokens
        patient_token = None
        user_token = None

        # 2. Extract User (DRF/SimpleJWT usually handles auth before this if placed correctly, 
        # or we rely on request.user if this runs after AuthMiddleware)
        if request.user.is_authenticated:
            user_token = user_context.set(request.user.id)

        # 3. Extract Patient Context Header
        # Django headers are usually HTTP_X_TARGET_PATIENT_ID
        patient_id = request.headers.get('X-Target-Patient-ID')
        
        if patient_id:
            try:
                p_id = int(patient_id)
                patient_token = target_patient_context.set(p_id)
                # logger.debug(f"👤 [DjangoMiddleware] Locked to Patient ID: {p_id}")
            except ValueError:
                pass

        try:
            response = self.get_response(request)
        finally:
            # 4. Cleanup
            if patient_token:
                target_patient_context.reset(patient_token)
            if user_token:
                user_context.reset(user_token)
                
        return response