# backend/vania_core/admin.py
from django.contrib import admin
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.html import format_html
from .models import (
    CaseAccessGrant,
    CaseContextEntry,
    RoleVerificationRequest, 
    DoctorProfile, 
    TreatmentConnection, 
    PatientInvite,
    Notification,
    SecureMessage,
    Location,
    GoogleCalendarConnection,
    ExpertMeetingLink,
)

@admin.register(RoleVerificationRequest)
class RoleVerificationRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'target_role', 'profession_label', 'submitted_code', 'status', 'created_at')
    list_filter = ('status', 'target_role', 'created_at')
    search_fields = ('user__phone_number', 'user__full_name')
    readonly_fields = ('user', 'target_role', 'created_at')
    
    fieldsets = (
        ('Applicant', {
            'fields': ('user', 'target_role', 'data')
        }),
        ('Verification Decision', {
            'fields': ('status', 'admin_notes'),
            'description': "Changing status to APPROVED will automatically trigger side effects via signals."
        }),
    )

    def profession_label(self, obj):
        return obj.data.get("profession_label") or obj.data.get("profession_slug") or "-"
    profession_label.short_description = "Profession"

    def submitted_code(self, obj):
        return obj.data.get("credential_code") or "-"
    submitted_code.short_description = "Submitted Code"

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)
    
@admin.register(DoctorProfile)
class DoctorProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'specialty', 'is_public', 'accepting_new_patients', 'created_at')
    list_filter = ('is_public', 'accepting_new_patients', 'specialty')
    search_fields = ('user__phone_number', 'user__full_name')
    autocomplete_fields = ['location']
    
@admin.register(TreatmentConnection)
class TreatmentConnectionAdmin(admin.ModelAdmin):
    list_display = ('doctor_phone', 'patient_phone', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('doctor__phone_number', 'patient__phone_number')
    autocomplete_fields = ['doctor', 'patient']
    
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        (None, {
            'fields': ('doctor', 'patient', 'status')
        }),
        ('Request Details', {
            'fields': ('request_data', 'notes'),
            'classes': ('collapse',),
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

    def doctor_phone(self, obj):
        return obj.doctor.phone_number
    doctor_phone.short_description = "Doctor"

    def patient_phone(self, obj):
        return obj.patient.phone_number
    patient_phone.short_description = "Patient"


@admin.register(CaseAccessGrant)
class CaseAccessGrantAdmin(admin.ModelAdmin):
    list_display = ("case_id", "patient", "owner_doctor", "grantee_doctor", "access_mode", "status", "updated_at")
    list_filter = ("status", "access_mode", "created_at", "updated_at")
    search_fields = (
        "case_id",
        "patient__phone_number",
        "patient__full_name",
        "owner_doctor__phone_number",
        "owner_doctor__full_name",
        "grantee_doctor__phone_number",
        "grantee_doctor__full_name",
    )
    autocomplete_fields = ["patient", "owner_doctor", "grantee_doctor", "granted_by"]
    readonly_fields = ("created_at", "updated_at")


@admin.register(CaseContextEntry)
class CaseContextEntryAdmin(admin.ModelAdmin):
    list_display = ("user", "doctor_scope", "case_count", "case_titles_preview", "is_active", "created_at")
    list_filter = ("is_active", "source", "created_at")
    search_fields = ("user__phone_number", "user__full_name", "definition__key", "data")
    autocomplete_fields = ["user", "created_by"]
    readonly_fields = ("definition", "doctor_scope", "case_count", "case_titles_preview", "created_at")
    fields = ("user", "definition", "doctor_scope", "case_count", "case_titles_preview", "data", "source", "created_by", "is_active", "created_at")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("user", "definition", "created_by")
            .filter(definition__key__startswith="vania_cases__doctor_")
        )

    def doctor_scope(self, obj):
        key = getattr(getattr(obj, "definition", None), "key", "") or ""
        return key.replace("vania_cases__doctor_", "") if key.startswith("vania_cases__doctor_") else "-"
    doctor_scope.short_description = "Owner Expert ID"

    def case_count(self, obj):
        cases = obj.data.get("cases", []) if isinstance(obj.data, dict) else []
        return len(cases) if isinstance(cases, list) else 0
    case_count.short_description = "Cases"

    def case_titles_preview(self, obj):
        cases = obj.data.get("cases", []) if isinstance(obj.data, dict) else []
        if not isinstance(cases, list) or not cases:
            return "-"
        titles = [str(item.get("title") or "بدون عنوان") for item in cases[:3]]
        suffix = " ..." if len(cases) > 3 else ""
        return " | ".join(titles) + suffix
    case_titles_preview.short_description = "Titles"

@admin.register(PatientInvite)
class PatientInviteAdmin(admin.ModelAdmin):
    list_display = ('phone_number', 'doctor', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('phone_number', 'doctor__phone_number')
    readonly_fields = ('id', 'created_at')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'title', 'type', 'is_read', 'created_at')
    list_filter = ('type', 'is_read', 'created_at')
    search_fields = ('recipient__phone_number', 'title', 'message')
    readonly_fields = ('created_at',)

@admin.register(SecureMessage)
class SecureMessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'recipient', 'short_content', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('sender__phone_number', 'recipient__phone_number', 'content')
    readonly_fields = ('created_at',)

    def short_content(self, obj):
        return (obj.content[:50] + '...') if len(obj.content) > 50 else obj.content
    short_content.short_description = "Content"


@admin.register(GoogleCalendarConnection)
class GoogleCalendarConnectionAdmin(admin.ModelAdmin):
    list_display = ("client_id", "calendar_id", "is_connected", "updated_at")
    readonly_fields = ("is_connected", "auth_link_display", "created_at", "updated_at")
    fieldsets = (
        ("Google OAuth", {
            "fields": ("client_id", "client_secret", "calendar_id"),
            "description": "Use a Google Cloud OAuth Web Application. This shared account is used for all platform-created Meet links.",
        }),
        ("Connection Status", {
            "fields": ("is_connected", "auth_link_display"),
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    def has_add_permission(self, request):
        return not GoogleCalendarConnection.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        obj = GoogleCalendarConnection.get_solo()
        return redirect(reverse("admin:vania_core_googlecalendarconnection_change", args=[obj.pk]))

    def auth_link_display(self, obj):
        if obj.client_id and obj.client_secret:
            url = reverse("vania_core:google-calendar-login")
            return format_html(
                '<a class="button" href="{}" target="_blank" '
                'style="background:#4285F4;color:white;padding:10px 15px;border-radius:4px;text-decoration:none;">'
                'Authenticate with Google'
                "</a>",
                url,
            )
        return "Enter Client ID and Client Secret, then save to enable authentication."

    auth_link_display.short_description = "Action Required"


@admin.register(ExpertMeetingLink)
class ExpertMeetingLinkAdmin(admin.ModelAdmin):
    list_display = ("creator", "visitor", "started_at", "created_at")
    search_fields = ("creator__phone_number", "visitor__phone_number", "meet_link", "google_event_id")
    readonly_fields = ("creator", "visitor", "google_event_id", "meet_link", "attendee_emails", "started_at", "ends_at", "created_at")

    def has_add_permission(self, request):
        return False
