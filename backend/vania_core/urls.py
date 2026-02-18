# backend/vania_core/urls.py
from django.urls import path
from .views import (
    # --- Existing Views ---
    DoctorInvitePatientView,
    DoctorPatientLookupView,
    PatientConnectionRequestsView,
    RespondToConnectionView,
    DoctorDashboardPatientsView,
    PublicDoctorListView,
    RequestAppointmentView,
    NotificationListView,
    MarkNotificationReadView,
    MarkAllNotificationsReadView,
    ConversationListView,
    MessageThreadView,
    RoleVerificationRequestView,
    CompleteTaskView,
    DoctorRespondToRequestView,
    DoctorUpdatePatientStatusView,
    DoctorProfileView,
    TaskManagementView, 
    SessionManagementView,
    LocationListView,
    RoadmapView,
    AppendixView,
    ActiveSessionView,
    SessionReportView,
    RoadmapView,
    AppendixView,
    ActiveSessionView,
    ClinicalTestsView,
    ClinicalTestFileUploadView,
    ClinicalTestFileDeleteView,
    ClinicalTestFileDownloadView,
)

app_name = 'vania_core'

urlpatterns = [
    # --- Existing Endpoints (Maintained for backward compatibility and other features) ---
    path('doctors/', PublicDoctorListView.as_view(), name='public-doctor-list'),
    path('doctors/<int:doctor_id>/request/', RequestAppointmentView.as_view(), name='request-appointment'),
    path('my-patients/', DoctorDashboardPatientsView.as_view(), name='doctor-dashboard-patients'),
    path('patients/invite/', DoctorInvitePatientView.as_view(), name='doctor-invite-patient'),
    path('patients/lookup/', DoctorPatientLookupView.as_view(), name='doctor-patient-lookup'),
    path('requests/', PatientConnectionRequestsView.as_view(), name='patient-connection-requests'),
    path('requests/<int:connection_id>/respond/', RespondToConnectionView.as_view(), name='respond-connection'),
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:pk>/read/', MarkNotificationReadView.as_view(), name='notification-mark-read'),
    path('notifications/read-all/', MarkAllNotificationsReadView.as_view(), name='notification-mark-all-read'),
    path('messages/inbox/', ConversationListView.as_view(), name='message-inbox'),
    path('messages/<int:other_user_id>/', MessageThreadView.as_view(), name='message-thread'),
    path('role-verification/', RoleVerificationRequestView.as_view(), name='role-verification-request'),
    path('my-tasks/<str:task_id>/complete/', CompleteTaskView.as_view(), name='complete-my-task'),
    path('my-patients/requests/<int:connection_id>/respond/', DoctorRespondToRequestView.as_view(), name='doctor-respond-to-request'),
    path('my-patients/<int:connection_id>/status/', DoctorUpdatePatientStatusView.as_view(), name='doctor-update-patient-status'),
    path('my-profile/', DoctorProfileView.as_view(), name='doctor-my-profile'),
    path('tasks/manage/', TaskManagementView.as_view(), name='task-create'),
    path('tasks/manage/<str:task_id>/', TaskManagementView.as_view(), name='task-update-delete'),
    path('sessions/manage/', SessionManagementView.as_view(), name='session-create'),
    path('sessions/manage/<int:entry_id>/', SessionManagementView.as_view(), name='session-update-delete'),
    path('locations/', LocationListView.as_view(), name='location-list'),

    # --- [NEW] Endpoints for Vania Clinical Operating System (VCOS) ---
    
    # Manages fetching the entire roadmap and adding new sessions to it.
    # GET: /api/vania/roadmap/?patient_id=...
    # POST: /api/vania/roadmap/
    path('roadmap/', RoadmapView.as_view(), name='therapy-roadmap'),
    
    # Manages fetching the thought appendix and prescribing new resources.
    # GET: /api/vania/appendix/?patient_id=...
    # POST: /api/vania/appendix/
    path('appendix/', AppendixView.as_view(), name='thought-appendix'),

    # Sets the currently active session for the agent's context.
    # POST: /api/vania/roadmap/active/
    path('roadmap/active/', ActiveSessionView.as_view(), name='set-active-session'),
    
    path('roadmap/report/', SessionReportView.as_view(), name='manage-session-report'),
    path('tests/', ClinicalTestsView.as_view(), name='clinical-tests'),
    path('tests/<str:test_id>/', ClinicalTestsView.as_view(), name='clinical-test-update-delete'),
    path('tests/<str:test_id>/file/', ClinicalTestFileUploadView.as_view(), name='clinical-test-file-upload'),
    path('tests/<str:test_id>/file/delete/', ClinicalTestFileDeleteView.as_view(), name='clinical-test-file-delete'),
    path('tests/<str:test_id>/file/download/', ClinicalTestFileDownloadView.as_view(), name='clinical-test-file-download'),
]
