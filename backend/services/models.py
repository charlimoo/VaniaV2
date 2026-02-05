# backend/services/models.py
from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid
from django.contrib.postgres.fields import ArrayField

# --- RAG Models ---
class KnowledgeBase(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self): return self.name

class KnowledgeDocument(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Processing'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    knowledge_base = models.ForeignKey(KnowledgeBase, related_name='documents', on_delete=models.CASCADE)
    file = models.FileField(upload_to='knowledge_docs/')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self): return f"{self.file.name} ({self.status})"

# --- Tooling Registry ---
class AvailableTool(models.Model):
    name = models.CharField(max_length=255, unique=True, help_text="Function name used by the LLM.")
    description = models.TextField(blank=True, help_text="Docstring extracted from the function.")
    import_path = models.CharField(max_length=500, help_text="Python dot-path")
    is_active = models.BooleanField(default=True)
    
    def __str__(self): return self.name

# --- Agent Service ---
class AgentService(models.Model):
    class StaticToolChoices(models.TextChoices):
        DUCKDUCKGO = 'duckduckgo', 'DuckDuckGo Search'
        YFINANCE = 'yfinance', 'Yahoo Finance'
        CALCULATOR = 'calculator', 'Calculator'
        PYTHON = 'python', 'Python Code Interpreter (Sandboxed)'

    class ReasoningEffort(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        NONE = 'none', 'None'
        DEFAULT = 'default', 'Default'

    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, help_text="URL identifier")
    description = models.TextField(blank=True)
    system_prompt = models.TextField(help_text="Core personality and instructions for the AI.")
    extra_config = models.JSONField(default=dict, blank=True, help_text="UI settings like canvas width.")
    model_id = models.CharField(
        max_length=100, 
        default="gpt-4o",
        help_text="The ID of the LLM to use (e.g., gpt-4o, gpt-5.1)."
    )

    demo_config = models.JSONField(
        default=dict, 
        blank=True,
        help_text="JSON object defining rules for users without a plan (e.g., limits, UI locks)."
    )
    
    # --- Access Control ---
    is_free = models.BooleanField(
        default=False, 
        help_text="If True, all users can access this agent regardless of their plan."
    )
    
    plans = models.ManyToManyField(
        'billing.SubscriptionPlan', 
        blank=True, 
        related_name='agents',
        help_text="Which subscription plans grant access to this agent?"
    )

    # --- UI & Meta ---
    tags = models.JSONField(
        default=list, 
        blank=True, 
        help_text="List of short tags for UI filtering. Managed via text input in Admin."
    )
    
    user_guide = models.TextField(
        blank=True, 
        help_text="Markdown text visible in the Agent Card."
    )

    capabilities = models.JSONField(
        default=list, 
        blank=True, 
        help_text="List of technical domains to load (e.g., 'trade', 'shop')."
    )

    # --- Operational ---
    is_public = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    
    # Resources
    knowledge_bases = models.ManyToManyField(KnowledgeBase, blank=True, related_name='agents')
    
    static_tools = models.JSONField(default=list, blank=True, help_text="List of built-in tools. Managed via checkboxes in Admin.")
    custom_tools = models.ManyToManyField(AvailableTool, blank=True, related_name='services')
    
    # --- Logic ---
    enable_reasoning = models.BooleanField(default=False)
    reasoning_effort = models.CharField(
        max_length=20,
        choices=ReasoningEffort.choices,
        default=ReasoningEffort.MEDIUM
    )
    
    enable_session_summaries = models.BooleanField(
        default=True,
        help_text="If True, older conversation history is compressed into a summary using gpt-4o-mini."
    )
    
    cost_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=1.00)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self): return self.name

# --- Frontend UI ---
class ServiceSuggestion(models.Model):
    service = models.ForeignKey(AgentService, related_name='suggestions', on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    subtitle = models.CharField(max_length=255, blank=True)
    prompt = models.TextField()
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self): return self.title

# --- Shared Link Model for Public Chat Sharing ---
class SharedLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.CharField(max_length=255, db_index=True)
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shared_links')
    
    agent_slug = models.CharField(max_length=255, blank=True)
    title = models.CharField(max_length=255, blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    views_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Share {self.id} -> {self.session_id}"

# --- CANVAS SYSTEM MODELS ---
from .models_canvas import CanvasType, AgentCanvasConfig, CanvasInstance

# --- FORM ENGINE MODELS ---
# InteractionForm model was removed in Phase 1