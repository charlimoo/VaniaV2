# backend/capabilities/__init__.py

# 1. Expose the registry and its decorators for use by other modules
from .registry import (
    register_capability, 
    register_tool, 
    register_canvas, 
    register_form_handler,
    CapabilityRegistry
)

# 2. Explicitly import capability modules.
# While the autodiscover() function in services/apps.py handles discovery,
# these explicit imports ensure that the @register decorators are executed
# during Django's initial app loading sequence. This makes the registry
# immediately aware of these core capabilities before any other part of the
# application tries to access them.

# -- Core Capability (Provides generic tools like charting) --
import capabilities.core.capability
import capabilities.core.canvas

# -- Vania Doctor Capability (Clinical Tools & Dashboard) --
import capabilities.vania_doctor.capability
import capabilities.vania_doctor.canvas
import capabilities.vania_doctor.forms
import capabilities.vania_doctor.tools

# -- Vania Patient Capability (Patient-facing Tools & UI) --
import capabilities.vania_patient.capability
import capabilities.vania_patient.canvas
import capabilities.vania_patient.tools

# -- Vania Expert Capability (General expert workflow) --
import capabilities.vania_expert.capability
import capabilities.vania_expert.canvas
import capabilities.vania_expert.forms
import capabilities.vania_expert.tools

# -- Vania Visitor Capability (General visitor workflow) --
import capabilities.vania_visitor.capability
import capabilities.vania_visitor.canvas
import capabilities.vania_visitor.tools
