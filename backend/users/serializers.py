from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import CustomUser, UserProfile, UserRole
from billing.models import UserWallet

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
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
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
    role_label = serializers.CharField(source='role.name', read_only=True)
    role_slug = serializers.CharField(source='role.slug', read_only=True)

    class Meta:
        model = CustomUser
        fields = (
            'id', 'phone_number', 'email', 'full_name', 
            'date_joined', 'password', 'wallet',
            'role_label', 'role_slug', 'medical_license', 'is_verified_doctor'
        )
        read_only_fields = ('phone_number', 'date_joined', 'id', 'role_label', 'role_slug', 'is_verified_doctor')

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            instance.save()
        return instance

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ('skin_type',)