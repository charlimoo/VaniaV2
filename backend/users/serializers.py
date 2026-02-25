from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import CustomUser, UserProfile
from billing.models import UserWallet
from .roles import (
    normalize_role_slug,
    CANONICAL_EXPERT_SLUG,
    CANONICAL_VISITOR_SLUG,
)

class PhoneSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)

class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    otp_code = serializers.CharField(max_length=6, min_length=6)

class PasswordLoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    password = serializers.CharField(style={'input_type': 'password'}, trim_whitespace=False)

    def validate(self, attrs):
        phone = attrs.get('phone_number')
        pwd = attrs.get('password')
        if not phone or not pwd:
            raise serializers.ValidationError("Credentials missing.")
        user = authenticate(request=self.context.get('request'), phone_number=phone, password=pwd)
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        attrs['user'] = user
        return attrs

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=False, allow_blank=True)
    new_password = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)

    def validate(self, attrs):
        user = self.context.get('user')
        has_existing_password = bool(getattr(user, 'password', '')) and user.has_usable_password() if user else False

        if has_existing_password and not attrs.get('old_password'):
            raise serializers.ValidationError({"old_password": "Current password is required."})

        if has_existing_password and user and not user.check_password(attrs.get('old_password', '')):
            raise serializers.ValidationError({"old_password": "Current password is incorrect."})

        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        validate_password(attrs['new_password'], user=user)
        return attrs

class UserWalletSerializer(serializers.ModelSerializer):
    balance_plan = serializers.CharField()
    balance_paid = serializers.CharField()
    daily_free_used = serializers.CharField()
    active_plan_name = serializers.CharField(source='active_plan.name', read_only=True, allow_null=True)
    plan_expires_at = serializers.DateTimeField(read_only=True, allow_null=True)
    
    class Meta:
        model = UserWallet
        fields = ('id', 'balance_plan', 'balance_paid', 'daily_free_used', 'updated_at', 'active_plan_name', 'plan_expires_at')

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})
    wallet = UserWalletSerializer(read_only=True)
    role_label = serializers.SerializerMethodField()
    role_slug = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()
    expert_profession_slug = serializers.SerializerMethodField()
    expert_profession_label = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id', 'phone_number', 'email', 'full_name', 
            'date_joined', 'password', 'wallet',
            'role_label', 'role_slug', 'medical_license', 'is_verified_doctor',
            'is_expert_verified', 'expert_profession_slug', 'expert_profession_label',
            'has_password'
        )
        read_only_fields = (
            'phone_number', 'date_joined', 'id', 'role_label', 'role_slug',
            'is_verified_doctor', 'is_expert_verified', 'expert_profession_slug', 'expert_profession_label'
        )

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            instance.save()
        return instance

    def get_has_password(self, obj):
        return bool(getattr(obj, 'password', '')) and obj.has_usable_password()

    def get_role_slug(self, obj):
        role = getattr(obj, "role", None)
        return normalize_role_slug(getattr(role, "slug", None))

    def get_role_label(self, obj):
        normalized = self.get_role_slug(obj)
        if normalized == CANONICAL_EXPERT_SLUG:
            return "متخصص"
        if normalized == CANONICAL_VISITOR_SLUG:
            return "مراجعه‌کننده"
        role = getattr(obj, "role", None)
        return getattr(role, "name", None)

    def get_expert_profession_slug(self, obj):
        profession = getattr(obj, "expert_profession", None)
        return getattr(profession, "slug", None)

    def get_expert_profession_label(self, obj):
        profession = getattr(obj, "expert_profession", None)
        return getattr(profession, "name", None)

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ('skin_type',)
