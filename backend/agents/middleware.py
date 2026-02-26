# backend/agents/middleware.py
import jwt
import logging
from fastapi import Request
from starlette.responses import JSONResponse
from asgiref.sync import sync_to_async
from django.conf import settings
from django.db import close_old_connections
from users.models import CustomUser
from .context import user_context, role_context, resource_context, selected_doctor_context

logger = logging.getLogger(__name__)

async def django_auth_middleware(request: Request, call_next):
    """
    Middleware to:
    1. Validate Django JWT tokens (Authentication).
    2. Extract Active Role (RBAC).
    3. Extract Target Resource Context (Scoped Execution).
    """
    token_reset = None
    role_reset = None
    resource_reset = None
    selected_doctor_reset = None
    user = None

    try:
        # Ensure stale DB connections are cleaned for FastAPI-managed requests.
        await sync_to_async(close_old_connections, thread_sensitive=True)()

        # 1. Bypass authentication for docs/public routes.
        if request.method == "OPTIONS" or request.url.path in ["/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)
        if request.method == "GET" and ("/share/" in request.url.path):
            return await call_next(request)

        # 2. Authenticate User via JWT
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                simple_jwt_config = getattr(settings, "SIMPLE_JWT", {})
                signing_key = simple_jwt_config.get("SIGNING_KEY", settings.SECRET_KEY)
                algorithm = simple_jwt_config.get("ALGORITHM", "HS256")

                raw_token = auth_header.split(" ")[1]
                payload = jwt.decode(raw_token, signing_key, algorithms=[algorithm])
                user_id = payload.get("user_id")

                if user_id:
                    token_reset = user_context.set(user_id)
                    try:
                        user = await CustomUser.objects.aget(pk=user_id)
                        if not user.is_active:
                            return JSONResponse(status_code=403, content={"detail": "User account is inactive"})
                    except CustomUser.DoesNotExist:
                        return JSONResponse(status_code=401, content={"detail": "User not found"})

            except jwt.ExpiredSignatureError:
                return JSONResponse(status_code=401, content={"detail": "Token has expired"})
            except jwt.PyJWTError:
                return JSONResponse(status_code=401, content={"detail": "Invalid authentication token"})
            except Exception as e:
                logger.error(f"Auth Middleware Error: {e}")
                return JSONResponse(status_code=500, content={"detail": "Authentication Error"})

        # 3. Resolve Contexts
        if user:
            requested_role_id = request.headers.get("X-Active-Role")
            active_role_id = None

            if requested_role_id:
                try:
                    role_id_int = int(requested_role_id)
                    if user.role_id == role_id_int:
                        active_role_id = role_id_int
                except ValueError:
                    pass

            if not active_role_id and user.role_id:
                active_role_id = user.role_id

            if active_role_id:
                role_reset = role_context.set(active_role_id)

            raw_resource_id = (
                request.headers.get("X-Target-Resource-ID")
                or request.headers.get("X-Target-Visitor-ID")
                or request.headers.get("X-Target-Patient-ID")
            )

            if raw_resource_id:
                resource_reset = resource_context.set(raw_resource_id)
                logger.debug(f"🔒 [Middleware] Context Locked to Resource ID: {raw_resource_id}")

            selected_expert_id = request.headers.get("X-Target-Expert-ID") or request.headers.get("X-Target-Doctor-ID")
            if selected_expert_id:
                selected_doctor_reset = selected_doctor_context.set(selected_expert_id)
                logger.debug(f"🩺 [Middleware] Context Locked to Expert ID: {selected_expert_id}")

        # 4. Process Request
        return await call_next(request)
    finally:
        # 5. Context Cleanup
        if token_reset: user_context.reset(token_reset)
        if role_reset: role_context.reset(role_reset)
        if resource_reset: resource_context.reset(resource_reset)
        if selected_doctor_reset: selected_doctor_context.reset(selected_doctor_reset)
        await sync_to_async(close_old_connections, thread_sensitive=True)()
