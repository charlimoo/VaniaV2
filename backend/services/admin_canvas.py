# backend/services/admin_canvas.py
from django.contrib import admin
from .models_canvas import AgentCanvasConfig

# Note: CanvasType and CanvasInstance ModelAdmins were removed from this file 
# as per the request to hide them from the Admin UI.
# A minimal, hidden version of CanvasTypeAdmin now lives in services/admin.py
# to power the search widget.

class AgentCanvasConfigInline(admin.TabularInline):
    """
    Inline to manage permissions for Agents to access Canvases.
    This can be imported by other admin files if needed.
    """
    model = AgentCanvasConfig
    extra = 1
    autocomplete_fields = ['canvas']