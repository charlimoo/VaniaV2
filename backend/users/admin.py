from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, UserProfile, UserRole, OTPRequest, ContextDefinition, UserContextEntry, ExpertProfession
from billing.models import UserWallet
from billing.forms import UserWalletAdminForm
from billing.services import activate_default_expert_plan_for_transferred_credits
from vania_core.models import RoleVerificationRequest
from .roles import CANONICAL_EXPERT_SLUG, normalize_role_slug

class UserWalletInline(admin.StackedInline):
    model = UserWallet
    form = UserWalletAdminForm
    can_delete = False
    verbose_name = "User Wallet"
    fields = ('balance_plan', 'balance_paid', 'daily_free_used', 'active_plan')
    readonly_fields = ('updated_at',)

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    fields = ('skin_type', 'updated_at')
    readonly_fields = ('updated_at',)

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = (
        'phone_number',
        'full_name',
        'national_code',
        'get_role',
        'expert_profession',
        'submitted_credential_code',
        'is_verified_doctor',
        'is_expert_verified',
        'date_joined',
    )
    list_filter = ('role', 'expert_profession', 'is_verified_doctor', 'is_expert_verified', 'is_staff', 'is_active')
    search_fields = ('phone_number', 'full_name', 'email', 'national_code')
    ordering = ('-date_joined',)
    
    fieldsets = (
        (None, {'fields': ('phone_number', 'password')}),
        ('Personal info', {'fields': ('full_name', 'email', 'national_code', 'role')}),
        ('Doctor Info', {'fields': ('expert_profession', 'medical_license', 'is_verified_doctor', 'is_expert_verified', 'expert_verified_at', 'expert_verification_meta')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone_number', 'password1', 'password2', 'full_name', 'email', 'national_code', 'role', 'expert_profession', 'is_active', 'is_staff'),
        }),
    )
    readonly_fields = ('expert_verified_at', 'expert_verification_meta', 'date_joined', 'last_login')
    inlines = (UserWalletInline, UserProfileInline)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)

        expert_role = UserRole.objects.filter(slug=CANONICAL_EXPERT_SLUG).first()
        if not expert_role:
            return

        role_slug = normalize_role_slug(getattr(getattr(obj, "role", None), "slug", None))
        meta = getattr(obj, "expert_verification_meta", None) or {}
        request_data = {
            "profession_slug": getattr(getattr(obj, "expert_profession", None), "slug", None),
            "profession_label": getattr(getattr(obj, "expert_profession", None), "name", None),
            "credential_code": meta.get("submitted_credential_code") or getattr(obj, "medical_license", None),
            "national_code": meta.get("submitted_national_code") or getattr(obj, "national_code", None),
            "full_name": getattr(obj, "full_name", None),
            "validation_kind": meta.get("validation_kind"),
        }

        latest_request = (
            RoleVerificationRequest.objects
            .filter(user=obj, target_role=expert_role)
            .order_by("-created_at", "-id")
            .first()
        )

        if role_slug == CANONICAL_EXPERT_SLUG and getattr(obj, "is_expert_verified", False):
            activate_default_expert_plan_for_transferred_credits(obj)
            if latest_request:
                if latest_request.status != RoleVerificationRequest.Status.APPROVED or latest_request.data != request_data:
                    latest_request.status = RoleVerificationRequest.Status.APPROVED
                    latest_request.data = request_data
                    latest_request.save(update_fields=["status", "data", "updated_at"])
            elif any(request_data.values()):
                RoleVerificationRequest.objects.create(
                    user=obj,
                    target_role=expert_role,
                    data=request_data,
                    status=RoleVerificationRequest.Status.APPROVED,
                    admin_notes="Created from direct admin user approval.",
                )
            return

        if meta.get("status") == "pending" and any(request_data.values()):
            if latest_request and latest_request.status == RoleVerificationRequest.Status.PENDING:
                if latest_request.data != request_data:
                    latest_request.data = request_data
                    latest_request.save(update_fields=["data", "updated_at"])
            else:
                RoleVerificationRequest.objects.create(
                    user=obj,
                    target_role=expert_role,
                    data=request_data,
                    status=RoleVerificationRequest.Status.PENDING,
                    admin_notes="Created from direct admin user edit.",
                )
            return

        if meta.get("status") == "rejected" and latest_request and latest_request.status != RoleVerificationRequest.Status.REJECTED:
            latest_request.status = RoleVerificationRequest.Status.REJECTED
            latest_request.admin_notes = meta.get("admin_notes") or latest_request.admin_notes
            latest_request.save(update_fields=["status", "admin_notes", "updated_at"])

    def get_deleted_objects(self, objs, request):
        deleted_objects, model_count, perms_needed, protected = super().get_deleted_objects(objs, request)

        # Allow wallet transactions to be removed as part of a user cascade-delete
        # even though transactions are not meant to be manually deletable in admin.
        filtered_perms = {perm for perm in perms_needed if perm.lower() != "transaction"}
        return deleted_objects, model_count, filtered_perms, protected

    def get_role(self, obj):
        return obj.role.name if obj.role else '-'
    get_role.short_description = 'Role'

    def submitted_credential_code(self, obj):
        meta = getattr(obj, "expert_verification_meta", None) or {}
        code = meta.get("submitted_credential_code")
        if code:
            return code
        return getattr(obj, "medical_license", "") or "-"
    submitted_credential_code.short_description = "Submitted Code"

@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')

@admin.register(ExpertProfession)
class ExpertProfessionAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'validation_kind', 'is_active')
    list_filter = ('is_active', 'validation_kind')
    search_fields = ('name', 'slug', 'description')

@admin.register(OTPRequest)
class OTPRequestAdmin(admin.ModelAdmin):
    list_display = ('phone_number', 'otp_code', 'created_at', 'expires_at', 'is_used')
    search_fields = ('phone_number',)

@admin.register(ContextDefinition)
class ContextDefinitionAdmin(admin.ModelAdmin):
    list_display = ('key', 'description')

@admin.register(UserContextEntry)
class UserContextEntryAdmin(admin.ModelAdmin):
    list_display = ('user', 'definition', 'created_at')
    search_fields = ('user__phone_number',)
