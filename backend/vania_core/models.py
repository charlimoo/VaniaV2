# backend/vania_core/models.py
import uuid
from urllib.parse import urlsplit
from django.db import models
from django.conf import settings
from users.models import UserRole, UserContextEntry


def normalize_tutorial_path(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return "/"

    parsed = urlsplit(value)
    path = parsed.path if parsed.scheme or parsed.netloc else value.split("?", 1)[0].split("#", 1)[0]
    path = "/" + path.strip("/")
    while "//" in path:
        path = path.replace("//", "/")
    return path if path == "/" else path.rstrip("/")

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

    @staticmethod
    def _has_profile_text(value) -> bool:
        return bool(str(value or "").strip())

    @staticmethod
    def _has_profile_sentence(value) -> bool:
        text = " ".join(str(value or "").split())
        return len(text) >= 10 and len(text.split()) >= 2

    def get_public_profile_missing_fields(self) -> list[str]:
        missing: list[str] = []

        if not self._has_profile_text(self.specialty):
            missing.append("specialty")
        if not self.location_id:
            missing.append("location")
        if not self._has_profile_text(self.clinic_address):
            missing.append("clinic_address")
        if not self._has_profile_sentence(self.bio):
            missing.append("bio")

        return missing

    @property
    def is_public_profile_complete(self) -> bool:
        return not self.get_public_profile_missing_fields()


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


class CaseAccessGrant(models.Model):
    """
    Read-only access grant that allows a visitor to share a case with another
    connected expert of the same profession.
    """

    class AccessMode(models.TextChoices):
        READ_ONLY = "READ_ONLY", "Read only"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        REVOKED = "REVOKED", "Revoked"

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="case_access_grants",
    )
    owner_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_case_access_grants",
    )
    grantee_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_case_access_grants",
    )
    case_id = models.CharField(max_length=64, db_index=True)
    access_mode = models.CharField(
        max_length=20,
        choices=AccessMode.choices,
        default=AccessMode.READ_ONLY,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_case_access_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["patient", "case_id", "grantee_doctor"],
                name="vania_case_access_unique_grantee_per_case",
            ),
        ]
        indexes = [
            models.Index(fields=["patient", "case_id", "status"]),
            models.Index(fields=["grantee_doctor", "status"]),
            models.Index(fields=["owner_doctor", "status"]),
        ]

    def __str__(self):
        return f"Case {self.case_id} | {self.owner_doctor_id} -> {self.grantee_doctor_id} ({self.status})"


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


class GoogleCalendarConnection(models.Model):
    """
    Stores the platform-wide Google Calendar OAuth credentials used for Meet creation.
    This is managed as a singleton from Django admin.
    """
    client_id = models.CharField(max_length=255, blank=True)
    client_secret = models.CharField(max_length=255, blank=True)
    calendar_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="Leave blank to use the primary calendar for the connected Google account.",
    )
    token_json = models.JSONField(default=dict, blank=True)
    is_connected = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Google Calendar Connection"
        verbose_name_plural = "Google Calendar Connection"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Platform Google Calendar Connection"


class ExpertMeetingLink(models.Model):
    """
    Audit log for Meet links generated by experts for their connected visitors.
    """
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_meeting_links",
    )
    visitor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_meeting_links",
    )
    google_event_id = models.CharField(max_length=255)
    meet_link = models.URLField()
    attendee_emails = models.JSONField(default=list, blank=True)
    started_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["creator", "-created_at"]),
            models.Index(fields=["visitor", "-created_at"]),
        ]

    def __str__(self):
        return f"Meet by {self.creator_id} for {self.visitor_id} at {self.created_at:%Y-%m-%d %H:%M}"


class PageTutorial(models.Model):
    title = models.CharField(max_length=255)
    page_path = models.CharField(
        max_length=500,
        help_text="Page path or full URL. Examples: /dashboard/patients or https://panel.vaniaapp.app/chat/tashkil-parvande/",
    )
    normalized_path = models.CharField(max_length=500, db_index=True, editable=False)
    video = models.FileField(upload_to="tutorials/videos/", max_length=500)
    is_public = models.BooleanField(default=True, help_text="If enabled, users can see this tutorial.")
    match_prefix = models.BooleanField(
        default=False,
        help_text="Enable for dynamic nested pages. Example: /chat/tashkil-parvande matches /chat/tashkil-parvande/local-...",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["normalized_path", "title"]
        indexes = [
            models.Index(fields=["is_public", "normalized_path"]),
        ]

    def save(self, *args, **kwargs):
        self.normalized_path = normalize_tutorial_path(self.page_path)
        super().save(*args, **kwargs)

    def matches_path(self, value: str) -> bool:
        current_path = normalize_tutorial_path(value)
        target_path = self.normalized_path or normalize_tutorial_path(self.page_path)
        if self.match_prefix:
            return current_path == target_path or current_path.startswith(f"{target_path}/")
        return current_path == target_path

    def __str__(self):
        mode = "prefix" if self.match_prefix else "exact"
        return f"{self.title} ({self.normalized_path}, {mode})"


class EsanjTestAccessRule(models.Model):
    """
    Local allowlist for Esanj tests.
    The upstream API owns questionnaire/result logic; Vania owns who can see/use each test.
    """

    esanj_test_id = models.PositiveIntegerField(unique=True, db_index=True)
    title = models.CharField(max_length=255)
    title_employee = models.CharField(max_length=255, blank=True)
    base_price = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True, help_text="Visible to eligible users when enabled.")
    allow_visitors = models.BooleanField(default=True)
    allow_experts = models.BooleanField(default=True)
    eligible_expert_professions = models.ManyToManyField(
        "users.ExpertProfession",
        blank=True,
        related_name="esanj_test_rules",
        help_text="Leave empty to allow every expert subtype when experts are enabled.",
    )
    notes = models.TextField(blank=True, help_text="Internal admin notes.")
    upstream_payload = models.JSONField(default=dict, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["esanj_test_id"]
        verbose_name = "Esanj Test Access Rule"
        verbose_name_plural = "Esanj Test Access Rules"
        indexes = [
            models.Index(fields=["is_active", "allow_visitors"]),
            models.Index(fields=["is_active", "allow_experts"]),
        ]

    def __str__(self):
        status = "active" if self.is_active else "inactive"
        return f"{self.esanj_test_id} - {self.title} ({status})"


class EsanjUserProfile(models.Model):
    """
    Optional upstream employee mapping for Vania users.
    Vania keeps its own history, but employee_id helps Esanj connect remote status/results.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="esanj_profile",
    )
    employee_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    employee_username = models.CharField(max_length=100, blank=True, db_index=True)
    upstream_payload = models.JSONField(default=dict, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Esanj User Profile"
        verbose_name_plural = "Esanj User Profiles"

    def __str__(self):
        return f"{self.user} -> {self.employee_id or 'not synced'}"


class EsanjTestAttempt(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        SUBMITTED = "SUBMITTED", "Submitted"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    class Sex(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="esanj_test_attempts",
    )
    invoice = models.OneToOneField(
        "billing.Invoice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="esanj_test_attempt",
        help_text="Paid invoice consumed by this interactive test attempt.",
    )
    access_rule = models.ForeignKey(
        EsanjTestAccessRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attempts",
    )
    clinical_test_id = models.CharField(max_length=64, blank=True, db_index=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_esanj_test_attempts",
    )
    doctor_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    case_id = models.CharField(max_length=64, blank=True, db_index=True)
    esanj_test_id = models.PositiveIntegerField(db_index=True)
    test_title = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS)
    age = models.PositiveSmallIntegerField()
    sex = models.CharField(max_length=10, choices=Sex.choices)
    employee_id = models.PositiveIntegerField(null=True, blank=True)
    questionnaire = models.JSONField(default=dict, blank=True)
    answers = models.JSONField(default=dict, blank=True)
    result_json = models.JSONField(default=dict, blank=True)
    grading_json = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["user", "-started_at"]),
            models.Index(fields=["user", "status"]),
            models.Index(fields=["user", "clinical_test_id"]),
            models.Index(fields=["user", "invoice"]),
            models.Index(fields=["esanj_test_id", "status"]),
        ]
        verbose_name = "Esanj Test Attempt"
        verbose_name_plural = "Esanj Test Attempts"

    def __str__(self):
        return f"{self.test_title} - {self.user} ({self.status})"


class CaseContextEntry(UserContextEntry):
    class Meta:
        proxy = True
        verbose_name = "Case Record"
        verbose_name_plural = "Case Records"
