# core/asgi.py
import os
import django
from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.staticfiles import StaticFiles
from django.conf import settings

# 1. Standard Django Setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

# 2. [NEW] Initialize Observability (Langfuse)
from agents.ops import init_observability
init_observability()

# 3. Import Applications (after setup and init)
from django.core.asgi import get_asgi_application
from agents.app import fastapi_app as agent_app

django_app = get_asgi_application()

routes = [
    # 1. Mount Agno Agent Runtime at /agent
    Mount('/agent', app=agent_app),
]

# 2. Serve Static Files via Starlette
# Ensure we check the setting value, not just the folder existence
if settings.STATIC_ROOT:
    static_root_str = str(settings.STATIC_ROOT) # Convert Path object to string
    if os.path.exists(static_root_str): # Check if the directory actually exists
        static_url = settings.STATIC_URL.rstrip('/')
        routes.append(
            Mount(static_url, app=StaticFiles(directory=static_root_str), name="static")
        )

# 3. Serve Media Files via Starlette (Local Mode Only)
# If USE_S3=True, MEDIA_URL is absolute (https://...) and won't match this route.
if settings.MEDIA_ROOT and settings.MEDIA_URL.startswith('/'):
    # Ensure media directory exists to prevent Starlette errors
    if not os.path.exists(settings.MEDIA_ROOT):
        os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
        
    media_url = settings.MEDIA_URL.rstrip('/')
    routes.append(
        Mount(media_url, app=StaticFiles(directory=settings.MEDIA_ROOT), name="media")
    )

# 4. Mount Django App (Catch-all for Admin, API, etc.)
routes.append(Mount('/', app=django_app))

application = Starlette(routes=routes)
# end of core/asgi.py