# backend/services/admin.py
from django.contrib import admin
from django.utils.html import format_html

from .models import (
    AgentService, 
    KnowledgeBase, 
    KnowledgeDocument, 
    AgentCanvasConfig,
    ServiceSuggestion,
    CanvasType
)
from .forms import AgentServiceForm

# Minimal, hidden admin for CanvasType to power the search widget
@admin.register(CanvasType)
class CanvasTypeAdmin(admin.ModelAdmin):
    search_fields = ('name', 'slug', 'component_key')

    def has_module_permission(self, request):
        # This hides it from the admin index page
        return False

# --- Inlines ---

class ServiceSuggestionInline(admin.TabularInline):
    model = ServiceSuggestion
    extra = 1
    can_delete = True
    fields = ('title', 'subtitle', 'prompt', 'order')

class AgentCanvasConfigInline(admin.TabularInline):
    model = AgentCanvasConfig
    extra = 0
    autocomplete_fields = ['canvas']

class KnowledgeDocumentInline(admin.TabularInline):
    model = KnowledgeDocument
    extra = 1
    fields = ('file', 'status', 'error_message')
    readonly_fields = ('status', 'error_message', 'created_at')

# --- Agent Service Admin ---

@admin.register(AgentService)
class AgentServiceAdmin(admin.ModelAdmin):
    form = AgentServiceForm
    list_display = ('name', 'slug', 'is_active', 'is_free', 'model_id')
    search_fields = ('name', 'slug')
    list_filter = ('is_active', 'is_free', 'model_id')
    prepopulated_fields = {'slug': ('name',)}
    
    readonly_fields = ()
    
    filter_horizontal = ('knowledge_bases', 'plans')
    inlines = [ServiceSuggestionInline, AgentCanvasConfigInline]
    save_on_top = True

    fieldsets = (
        ('Identity & AI Brain', {
            'fields': ('name', 'slug', 'model_id', 'description', 'system_prompt'),
            'description': "Core identity of the Agent."
        }),
        ('Capabilities & Tools', {
            'fields': ('enable_web_search', 'capabilities', 'tags_input', 'tags', 'static_tools'),
            'description': "Manage what the agent can do. (Raw JSON fields are hidden and managed by the inputs above)."
        }),
        ('Economics & Reasoning', {
            'fields': ('cost_multiplier', 'reasoning_effort'),
        }),
        ('Status & Access', {
            'fields': ('is_active', 'is_free', 'is_public', 'plans'),
            'description': "Manage visibility and plan restrictions."
        }),
        ('Demo Rules', {
            'fields': ('demo_config',),
            'description': "Configuration for users without a plan."
        }),
        ('UI Configuration', {
            'fields': ('user_guide', 'extra_config'),
        }),
        ('Resources', {
            'fields': ('knowledge_bases',),
            'description': "Knowledge Bases for RAG."
        }),
    )

    def get_changeform_initial_data(self, request):
        """
        Sets defaults for new Agents to speed up creation.
        """
        return {
            'model_id': 'gpt-4o',
            'cost_multiplier': 1.0,
            'is_free': False,
            'reasoning_effort': 'medium',
            'system_prompt': (
                "You are a helpful and intelligent AI assistant.\n"
                "You answer in Persian (Farsi).\n"
                "Be concise and professional."
            ),
            'demo_config': {
                "access_mode": "ALLOWED",
                "message_limit_scope": "SESSION",
                "message_limit_count": 5,
                "canvas_mode": "LOCKED",
                "canvas_placeholder_text": "Upgrade to Pro to access this feature."
            }
        }

# --- RAG Admins ---

@admin.register(KnowledgeBase)
class KnowledgeBaseAdmin(admin.ModelAdmin):
    list_display = ('name', 'count_docs', 'created_at')
    search_fields = ('name',)
    inlines = [KnowledgeDocumentInline]

    def count_docs(self, obj):
        return obj.documents.count()
    count_docs.short_description = "Documents"