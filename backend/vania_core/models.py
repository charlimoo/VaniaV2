# backend/vania_core/models.py
import uuid
from django.db import models
from django.conf import settings
from users.models import UserRole

# --- 1. PROFESSIONAL IDENTITY & VERIFICATION ---

class RoleVerificationRequest(models.Model):
    """
    A generic request system for users to claim specific Roles (e.g. Doctor).
    The data required is defined dynamically by the 'verification_form_config' 
    on the target UserRole model in the users app.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='verification_requests'
    )
    
    # Link to the specific Role the user is applying for
    target_role = models.ForeignKey(
        UserRole, 
        on_delete=models.CASCADE, 
        related_name='verification_requests'
    )
    
    # Generic storage for form data (License No, National ID, Files, etc.)
    data = models.JSONField(
        default=dict, 
        help_text="Dynamic form data submitted by the user."
    )
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    admin_notes = models.TextField(blank=True, help_text="Reason for rejection or internal notes")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Role Verification Request"
        verbose_name_plural = "Role Verification Requests"

    def __str__(self):
        return f"{self.user} -> {self.target_role.name} ({self.status})"

class Location(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="e.g. Tehran - North, Isfahan, etc.")
    
    def __str__(self):
        return self.name
    
class DoctorProfile(models.Model):
    """
    Public profile specifically for the 'Doctor' role to appear in the Directory.
    Created automatically via Signals when a Doctor Role request is Approved.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='doctor_profile'
    )
    
    bio = models.TextField(blank=True, help_text="Markdown supported")
    avatar = models.ImageField(upload_to='doctors/avatars/', blank=True, null=True)
    clinic_address = models.TextField(blank=True)
    specialty = models.CharField(max_length=100, blank=True)
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name='doctors')
    is_public = models.BooleanField(
        default=False, 
        help_text="Show in the 'Find a Doctor' directory?"
    )
    
    accepting_new_patients = models.BooleanField(
        default=True,
        help_text="If False, patients cannot send new appointment requests."
    )
    
    meeting_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0, 
        help_text="Cost per session (optional)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Dr. {self.user.full_name or self.user.phone_number}"


# --- 2. RELATIONSHIPS (THE GRAPH) ---

class TreatmentConnection(models.Model):
    """
    The Graph Edge: Represents a professional relationship between a Doctor and a Patient.
    Controls data access permissions (Doctor Agent can only read Patient data if ACTIVE).
    """
    class Status(models.TextChoices):
        # 1. Doctor invited patient -> Waiting for Patient to confirm
        PENDING_PATIENT_APPROVAL = 'PENDING_PATIENT', 'Waiting for Patient'
        
        # 2. Patient requested appointment -> Waiting for Doctor to confirm
        PENDING_DOCTOR_APPROVAL = 'PENDING_DOCTOR', 'Waiting for Doctor'
        
        # 3. Connection established (Data sharing active)
        ACTIVE = 'ACTIVE', 'Active'
        
        # 4. Connection ended or declined
        REJECTED = 'REJECTED', 'Rejected'
        ARCHIVED = 'ARCHIVED', 'Archived'

    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='doctor_connections',
        help_text="The professional managing the treatment."
    )
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='patient_connections',
        help_text="The user receiving care."
    )
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_PATIENT_APPROVAL)
    
    # Persistent storage for the Appointment Request Form
    # Stores: { main_concern, history_brief, preferred_time, ... }
    request_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Snapshot of the patient's request details (Symptoms, History, etc)."
    )
    
    notes = models.TextField(
        blank=True, 
        help_text="Private administrative notes for the doctor (e.g. 'Referral from Dr. X')."
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('doctor', 'patient')
        indexes = [
            models.Index(fields=['doctor', 'status']),
            models.Index(fields=['patient', 'status']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Dr. {self.doctor.phone_number} <-> {self.patient.phone_number} ({self.status})"


class PatientInvite(models.Model):
    """
    Growth Mechanism: Allows doctors to add patients who are not yet users of Vania.
    An SMS is sent with a link containing the unique token.
    """
    class InviteStatus(models.TextChoices):
        SENT = 'SENT', 'Sent'
        REGISTERED = 'REGISTERED', 'Registered & Linked'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='sent_invites'
    )
    
    phone_number = models.CharField(max_length=20, db_index=True)
    status = models.CharField(max_length=20, choices=InviteStatus.choices, default=InviteStatus.SENT)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invite for {self.phone_number} by Dr. {self.doctor.phone_number}"


# --- 3. COMMUNICATION & NOTIFICATIONS ---

class Notification(models.Model):
    """
    System-wide notifications (e.g., Connection Requests, New Tasks).
    Used for in-app alerts (Bell Icon).
    """
    class Type(models.TextChoices):
        CONNECTION_REQUEST = 'CONNECTION_REQUEST', 'درخواست مشاوره'
        TASK_ASSIGNED = 'TASK_ASSIGNED', 'تکلیف جدید'
        FORM_REQUEST = 'FORM_REQUEST', 'درخواست تکمیل فرم'
        NEW_MESSAGE = 'NEW_MESSAGE', 'پیام جدید'
        SYSTEM = 'SYSTEM', 'پیام سیستم'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='notifications'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=50, choices=Type.choices, default=Type.SYSTEM)
    
    # Store arbitrary data including 'url' for deep linking
    # Example: { "url": "/dashboard/patients?tab=REQUESTS", "connection_id": 12 }
    payload = models.JSONField(default=dict, blank=True)
    
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
        ]

    def __str__(self):
        return f"{self.title} -> {self.recipient.phone_number}"


class SecureMessage(models.Model):
    """
    Direct communication between Doctor and Patient.
    Supports Text, Audio, Images, and Files.
    """
    class MessageType(models.TextChoices):
        TEXT = 'TEXT', 'Text'
        AUDIO = 'AUDIO', 'Audio'
        IMAGE = 'IMAGE', 'Image'
        FILE = 'FILE', 'File'

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='sent_messages'
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='received_messages'
    )
    
    # [UPDATED] Content is now optional (e.g. for Audio only messages)
    content = models.TextField(blank=True)
    
    # [NEW] Fields for File Support
    attachment = models.FileField(upload_to='secure_messages/%Y/%m/', blank=True, null=True)
    message_type = models.CharField(max_length=10, choices=MessageType.choices, default=MessageType.TEXT)
    metadata = models.JSONField(default=dict, blank=True, help_text="Stores file size, duration, etc.")

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at'] 
        indexes = [
            models.Index(fields=['sender', 'recipient']),
            models.Index(fields=['recipient', 'is_read']),
        ]

    def __str__(self):
        return f"{self.sender} -> {self.recipient} [{self.message_type}]"