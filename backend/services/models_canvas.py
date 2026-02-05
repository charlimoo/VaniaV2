# services/models_canvas.py
import uuid
from django.db import models

class CanvasType(models.Model):
    """
    Defines the 'Class' of a canvas.
    Example: 'Sales Dashboard', 'Markdown Editor'.
    """
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, help_text="Unique identifier, e.g., 'sales-dashboard-v1'")
    description = models.TextField(blank=True, help_text="Context description for the LLM.")
    
    # Maps to a React component in the frontend registry
    component_key = models.CharField(
        max_length=100, 
        help_text="Key for the React Component (e.g., 'RECHARTS_DASHBOARD', 'TEXT_EDITOR')"
    )
    
    # JSON Schema to validate updates (Optional but recommended for robustness)
    schema_definition = models.JSONField(default=dict, blank=True)
    
    # The initial state when a new instance is created
    default_state = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class AgentCanvasConfig(models.Model):
    """
    Configures which Agents have access to which Canvases.
    """
    class Permission(models.TextChoices):
        READ_ONLY = 'READ', 'Read Only'
        READ_WRITE = 'WRITE', 'Read & Write'

    # Use string reference 'services.AgentService' to avoid circular import 
    # because services/models.py imports this file.
    agent = models.ForeignKey('services.AgentService', on_delete=models.CASCADE, related_name='canvas_configs')
    canvas = models.ForeignKey(CanvasType, on_delete=models.CASCADE, related_name='agent_configs')
    
    is_default_open = models.BooleanField(
        default=False, 
        help_text="Should this canvas open automatically when a chat starts?"
    )
    
    permission_level = models.CharField(
        max_length=10, 
        choices=Permission.choices, 
        default=Permission.READ_WRITE
    )

    class Meta:
        unique_together = ('agent', 'canvas')
        verbose_name = "Agent Canvas Configuration"

    def __str__(self):
        return f"{self.agent.name} -> {self.canvas.name}"

class CanvasInstance(models.Model):
    """
    The runtime state of a specific canvas in a specific chat session.
    Decoupled from the Chat History log to prevent DB bloat.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Links to the Chat Session ID (AgentSession.session_id)
    # We use a CharField and db_index for fast lookups without strict FK constraints 
    # to Agno's internal tables (which might be in a different DB or format).
    session_id = models.CharField(max_length=255, db_index=True)
    
    canvas_def = models.ForeignKey(CanvasType, on_delete=models.PROTECT)
    
    # The live data of the canvas
    current_state = models.JSONField(default=dict)
    
    # UI State persistence
    is_visible = models.BooleanField(default=True, help_text="Was this tab open/visible last time?")
    
    last_modified_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Index for fast hydration queries
        indexes = [
            models.Index(fields=['session_id', 'created_at']),
        ]
        ordering = ['created_at']

    def __str__(self):
        return f"Instance: {self.canvas_def.name} (Session: {self.session_id})"