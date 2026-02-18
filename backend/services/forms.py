# backend/services/forms.py
from django import forms
from django_jsonform.widgets import JSONFormWidget
from .models import AgentService

# --- JSON SCHEMAS FOR VISUAL EDITORS ---
def _get_capability_domains():
    """
    Build capability choices from the registry so admin stays in sync
    with backend/capabilities modules.
    """
    try:
        from capabilities import CapabilityRegistry

        CapabilityRegistry.autodiscover()
        domains = sorted(CapabilityRegistry._domain_capabilities.keys())
        if domains:
            return domains
    except Exception:
        pass

    # Safe fallback for first-load edge cases
    return ["core"]

CAPABILITIES_SCHEMA = {
    "type": "array",
    "title": "Enabled Capabilities",
    "items": {
        "type": "string",
        "title": "Domain",
        "enum": _get_capability_domains(),
        "widget": "select"
    }
}

DEMO_CONFIG_SCHEMA = {
    "type": "object",
    "title": "Demo Configuration",
    "properties": {
        "access_mode": {
            "type": "string",
            "title": "Access Mode",
            "choices": ["ALLOWED", "BLOCKED"],
            "default": "ALLOWED",
            "widget": "select"
        },
        "message_limit_scope": {
            "type": "string",
            "title": "Limit Scope",
            "choices": ["SESSION", "DAILY", "TOTAL", "NONE"],
            "default": "SESSION",
            "widget": "select"
        },
        "message_limit_count": {
            "type": "integer",
            "title": "Message Limit Count",
            "default": 5
        },
        "canvas_mode": {
            "type": "string",
            "title": "Canvas Mode",
            "choices": ["HIDDEN", "LOCKED", "OPEN"],
            "default": "LOCKED",
            "widget": "select"
        },
        "canvas_placeholder_text": {
            "type": "string",
            "title": "Canvas Placeholder (Locked Mode)",
            "widget": "textarea",
            "default": "This feature requires a Pro plan."
        },
        "model_override": {
            "type": "string",
            "title": "Model Override (Optional)",
            "required": False,
            "help_text": "e.g., gpt-4o-mini"
        }
    }
}

EXTRA_CONFIG_SCHEMA = {
    "type": "object",
    "title": "UI Configuration",
    "properties": {
        "has_canvas": {
            "type": "boolean",
            "title": "Enable Canvas Panel",
            "default": False
        },
        "default_width": {
            "type": "integer",
            "title": "Default Canvas Width (%)",
            "default": 50,
            "minimum": 20,
            "maximum": 90
        },
        "show_voice_input": {
            "type": "boolean",
            "title": "Show Voice Input",
            "default": True
        }
    }
}

class AgentServiceForm(forms.ModelForm):
    """
    Custom Admin Form for AgentService.
    Handles:
    1. Visual JSON Editors for complex fields.
    2. Virtual fields for Tags and Web Search to provide a better UX.
    """

    # Virtual field for Web Search (Boolean -> List)
    enable_web_search = forms.BooleanField(
        required=False,
        label="Enable Web Search (DuckDuckGo)",
        help_text="If checked, the agent can search the web using DuckDuckGo."
    )

    # Virtual field for Tags (Text Input -> JSON List)
    tags_input = forms.CharField(
        required=False,
        label="Tags",
        help_text="Enter tags separated by commas (e.g., 'Pro, Analysis').",
        widget=forms.TextInput(attrs={'placeholder': 'Tag1, Tag2', 'style': 'width: 400px;'})
    )

    class Meta:
        model = AgentService
        fields = '__all__'
        widgets = {
            'capabilities': JSONFormWidget(schema=CAPABILITIES_SCHEMA),
            'demo_config': JSONFormWidget(schema=DEMO_CONFIG_SCHEMA),
            'extra_config': JSONFormWidget(schema=EXTRA_CONFIG_SCHEMA),
            # Hide raw JSON fields that are handled by the virtual inputs above
            'static_tools': forms.HiddenInput(),
            'tags': forms.HiddenInput(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # If we are editing an existing agent instance...
        if self.instance and self.instance.pk:
            # 1. Populate the 'Enable Web Search' checkbox from the raw static_tools list
            current_tools = self.instance.static_tools or []
            self.fields['enable_web_search'].initial = 'duckduckgo' in current_tools
            
            # 2. Populate the 'Tags' text input from the raw tags list
            if self.instance.tags:
                self.fields['tags_input'].initial = ", ".join(self.instance.tags)

    def clean(self):
        cleaned_data = super().clean()
        
        # 1. Save Web Search Logic: Convert boolean checkbox back to a list
        is_web_enabled = cleaned_data.get('enable_web_search')
        tools_list = []
        if is_web_enabled:
            tools_list.append('duckduckgo')
        cleaned_data['static_tools'] = tools_list
            
        # 2. Save Tags Logic: Convert comma-separated string back to a list
        raw_tags_string = cleaned_data.get('tags_input', '')
        if raw_tags_string:
            tag_list = [tag.strip() for tag in raw_tags_string.split(',') if tag.strip()]
            cleaned_data['tags'] = tag_list
        else:
            cleaned_data['tags'] = []
            
        return cleaned_data
