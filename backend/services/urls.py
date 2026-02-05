# backend/services/urls.py
from django.urls import path
from .views import (
    ServiceListView, 
    SubmitFormView
)

urlpatterns = [
    # --- AGENT SERVICE DISCOVERY ---
    path('', ServiceListView.as_view(), name='service-list'),

    # --- GENERIC FORM HANDLER ---
    # Used by frontend to submit forms defined by Capability Canvas/Tools
    path('forms/submit/', SubmitFormView.as_view(), name='generic-form-submit'),
]