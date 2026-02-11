# backend/vania_core/serializers.py
import json
import logging
from rest_framework import serializers
from .models import (
    TreatmentConnection, 
    DoctorProfile, 
    Notification, 
    SecureMessage, 
    RoleVerificationRequest,
    Location 
)
from users.models import UserRole, CustomUser
from .schemas import RescueDimension, ResourceType, TherapyPhase

logger = logging.getLogger(__name__)

# ==============================================================================
# == 1. ROLE VERIFICATION & DOCTOR PROFILE SERIALIZERS
# ==============================================================================

class RoleVerificationRequestSerializer(serializers.ModelSerializer):
    """
    Handles the creation and validation of requests from users to gain a specific role (e.g., 'doctor').
    """
    target_role_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = RoleVerificationRequest
        fields = ['target_role_id', 'data', 'status', 'admin_notes', 'created_at']
        read_only_fields = ['status', 'admin_notes', 'created_at']

    def validate_target_role_id(self, value):
        if not UserRole.objects.filter(pk=value).exists():
            raise serializers.ValidationError("The specified Role ID is invalid.")
        return value

class LocationSerializer(serializers.ModelSerializer):
    """Serializer for geographic locations (e.g., cities for doctor profiles)."""
    class Meta:
        model = Location
        fields = ['id', 'name']

class PublicDoctorSerializer(serializers.ModelSerializer):
    """
    Serializes doctor profiles for the public "Find a Doctor" directory.
    Excludes sensitive information and includes calculated fields.
    """
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    avatar = serializers.SerializerMethodField()
    location_name = serializers.CharField(source='location.name', read_only=True, allow_null=True)
    
    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'full_name', 'specialty', 'bio', 
            'clinic_address', 'location_name', 'avatar', 'meeting_price',
            'accepting_new_patients'
        ]

    def get_avatar(self, obj):
        if obj.avatar and hasattr(obj.avatar, 'url'):
            request = self.context.get('request')
            return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url
        return None
        
class DoctorProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for allowing a doctor to update their own profile."""
    location_id = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(), 
        source='location', 
        required=False, 
        allow_null=True
    )
    avatar = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = DoctorProfile
        fields = [
            'bio', 'clinic_address', 'location_id', 'specialty',
            'is_public', 'accepting_new_patients', 'meeting_price', 'avatar'
        ]

# ==============================================================================
# == 2. PATIENT MANAGEMENT & CONNECTION SERIALIZERS
# ==============================================================================

class InvitePatientSerializer(serializers.Serializer):
    """
    Validates data for a doctor adding a new patient.
    [MODIFIED] Includes demographic fields required for Phase 1 analysis.
    """
    phone_number = serializers.CharField(max_length=20, required=True)
    full_name = serializers.CharField(max_length=100, required=True, allow_blank=False)
    
    # --- Demographics for Phase 1 ---
    age = serializers.IntegerField(required=False, min_value=0, max_value=120, allow_null=True)
    marital_status = serializers.CharField(required=False, allow_blank=True)
    education = serializers.CharField(required=False, allow_blank=True)
    job = serializers.CharField(required=False, allow_blank=True)

class ConnectionListSerializer(serializers.ModelSerializer):
    """
    Used for dashboards to list patient connections and pending requests.
    Includes details from related User and Profile models.
    """
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    patient_phone = serializers.CharField(source='patient.phone_number', read_only=True)
    doctor_avatar = serializers.SerializerMethodField()
    specialty = serializers.CharField(source='doctor.doctor_profile.specialty', read_only=True)

    class Meta:
        model = TreatmentConnection
        fields = [
            'id', 'doctor_name', 'doctor_avatar', 'specialty', 
            'patient_name', 'patient_phone', 'status', 'created_at', 
            'updated_at', 'request_data'
        ]

    def get_doctor_avatar(self, obj):
        if hasattr(obj.doctor, 'doctor_profile') and obj.doctor.doctor_profile.avatar:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.doctor.doctor_profile.avatar.url) if request else obj.doctor.doctor_profile.avatar.url
        return None

class RespondConnectionSerializer(serializers.Serializer):
    """Validates the 'ACCEPT' or 'REJECT' action for connection requests."""
    action = serializers.ChoiceField(choices=['ACCEPT', 'REJECT'])

class AppointmentRequestSerializer(serializers.Serializer):
    """Validates the form data a patient submits when requesting a doctor."""
    main_concern = serializers.CharField(required=True, label="Main Concern")
    history_brief = serializers.CharField(required=False, label="Brief History", allow_blank=True)
    preferred_time = serializers.CharField(required=False, label="Preferred Time", allow_blank=True)

# ==============================================================================
# == 3. NOTIFICATION & MESSAGING SERIALIZERS
# ==============================================================================

class NotificationSerializer(serializers.ModelSerializer):
    """Read-only serializer for in-app notifications."""
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'type', 'payload', 'is_read', 'created_at']
        read_only_fields = fields

class SecureMessageSerializer(serializers.ModelSerializer):
    """Serializer for individual chat messages, handling text, files, and metadata."""
    is_me = serializers.SerializerMethodField()
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    attachment_url = serializers.SerializerMethodField()
    content = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = SecureMessage
        fields = [
            'id', 'sender', 'sender_name', 'recipient', 'content', 'is_read', 
            'created_at', 'is_me', 'attachment', 'attachment_url', 'message_type', 'metadata'
        ]
        read_only_fields = ['sender', 'recipient', 'created_at', 'is_read', 'attachment_url']

    def get_is_me(self, obj):
        request = self.context.get('request')
        return obj.sender == request.user if request else False

    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.attachment.url) if request else obj.attachment.url
        return None

class ConversationSerializer(serializers.Serializer):
    """Represents a summary of a conversation thread in the user's inbox."""
    user_id = serializers.IntegerField()
    name = serializers.CharField()
    phone_number = serializers.CharField()
    avatar = serializers.CharField(allow_null=True)
    role_label = serializers.CharField() 
    specialty = serializers.CharField(required=False, allow_blank=True)
    last_message = serializers.CharField()
    last_message_date = serializers.DateTimeField()
    unread_count = serializers.IntegerField()

# ==============================================================================
# == 4. VCOS 6-PHASE PROTOCOL SERIALIZERS
# ==============================================================================

class RoadmapSessionSerializer(serializers.Serializer):
    """Serializer for a single session within the Therapy Roadmap."""
    session_number = serializers.IntegerField()
    title = serializers.CharField()
    status = serializers.CharField()
    scheduled_date = serializers.CharField(required=False, allow_null=True)
    doctor_instructions = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    doc_id = serializers.CharField(required=False, allow_null=True)

class TherapyRoadmapSerializer(serializers.Serializer):
    """Serializer for the complete Therapy Roadmap object."""
    current_phase = serializers.ChoiceField(choices=[p.value for p in TherapyPhase])
    treatment_approaches = serializers.ListField(child=serializers.CharField())
    sessions = RoadmapSessionSerializer(many=True)
    active_session_number = serializers.IntegerField(required=False, allow_null=True)
    created_at = serializers.CharField()
    updated_at = serializers.CharField()

class CulturalResourceSerializer(serializers.Serializer):
    """Serializer for adding or viewing a resource in the Thought Appendix."""
    id = serializers.CharField(read_only=True)
    type = serializers.ChoiceField(choices=[t.value for t in ResourceType])
    title = serializers.CharField(max_length=200)
    creator = serializers.CharField(max_length=100, label="Author/Director/Poet")
    reason_for_prescription = serializers.CharField()
    content_excerpt = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    status = serializers.CharField(read_only=True)

class AddSessionSerializer(serializers.Serializer):
    """Validates data for manually adding a new planned session to the roadmap."""
    title = serializers.CharField(max_length=200)
    instructions = serializers.CharField(required=False, allow_blank=True, allow_null=True)