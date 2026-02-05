# backend/vania_core/admin.py
from django.contrib import admin
from .models import (
    RoleVerificationRequest, 
    DoctorProfile, 
    TreatmentConnection, 
    PatientInvite,
    Notification,
    SecureMessage,
    Location 
)

@admin.register(RoleVerificationRequest)
class RoleVerificationRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'target_role', 'status', 'created_at')
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