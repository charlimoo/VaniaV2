# agents/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import router as agent_router
from .middleware import django_auth_middleware

# --- NEW: Import Canvas Router ---
from canvas.routes import router as canvas_router
from core.ai_provider import get_ai_provider_config

get_ai_provider_config()
fastapi_app = FastAPI(title="Aegra Agent Runtime")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Apply Django Auth Middleware
fastapi_app.middleware("http")(django_auth_middleware)

# --- Mount Routes ---
# 1. Agent Runtime Routes (Chat, Streaming)
fastapi_app.include_router(agent_router) 

# 2. Canvas System Routes (State Hydration, User Sync)
fastapi_app.include_router(canvas_router, prefix="/canvas", tags=["Canvas"])