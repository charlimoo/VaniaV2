from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, UserProfile, UserRole, OTPRequest, ContextDefinition, UserContextEntry
from billing.models import UserWallet
from billing.forms import UserWalletAdminForm

class UserWalletInline(admin.StackedInline):
    model = UserWallet
    form = UserWalletAdminForm
    can_delete = False
    verbose_name = "User Wallet"
    fields = ('balance_plan', 'balance_paid', 'daily_free_used', 'active_plan', 'plan_expires_at')
    readonly_fields = ('updated_at',)

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    fields = ('skin_type', 'updated_at')
    readonly_fields = ('updated_at',)

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('phone_number', 'full_name', 'get_role', 'is_verified_doctor', 'date_joined')
    list_filter = ('role', 'is_verified_doctor', 'is_staff', 'is_active')
    search_fields = ('phone_number', 'full_name', 'email')
    ordering = ('-date_joined',)
    
    fieldsets = (
        (None, {'fields': ('phone_number', 'password')}),
        ('Personal info', {'fields': ('full_name', 'email', 'role')}),
        ('Doctor Info', {'fields': ('medical_license', 'is_verified_doctor')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    inlines = (UserWalletInline, UserProfileInline)

    def get_role(self, obj):
        return obj.role.name if obj.role else '-'
    get_role.short_description = 'Role'

@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')

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