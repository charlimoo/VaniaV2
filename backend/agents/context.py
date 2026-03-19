# backend/agents/context.py
from contextvars import ContextVar

# Tracks the authenticated User ID for the current request context.
# This allows tools and services to access the current user without passing it explicitly.
user_context = ContextVar("user_id", default=None)

# Tracks the Active Role ID (e.g., 'Doctor', 'Patient') for the current request.
# Used for Rate Limiting and Role-Based Access Control checks deep in the stack.
role_context = ContextVar("role_id", default=None)

# [NEW] Tracks the Scoped Resource ID for the current request.
# This acts as a generic "Target ID". In Vania, this holds the Patient ID.
# In a Trading App, it might hold a Portfolio ID.
resource_context = ContextVar("resource_id", default=None)

# Tracks the selected doctor context for scoped patient-facing data.
selected_doctor_context = ContextVar("selected_doctor_id", default=None)

# Tracks the selected case context for case-scoped patient/expert data.
selected_case_context = ContextVar("selected_case_id", default=None)

# [LEGACY ALIAS] Alias for Vania compatibility.
# Existing Vania tools that import 'target_patient_context' will actually read 'resource_context'.
target_patient_context = resource_context
