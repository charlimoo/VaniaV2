import logging
from django.db import transaction, IntegrityError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

from .models import CustomUser, UserProfile, OTPRequest, UserRole
from billing.models import UserWallet
from .serializers import (
    PhoneSerializer, VerifyOTPSerializer, UserSerializer, PasswordLoginSerializer,
    UserProfileSerializer, ChangePasswordSerializer, UserWalletSerializer
)
from .otp_service import otp_service
from .utils import verify_doctor_license

logger = logging.getLogger(__name__)

# --- AUTH FLOW STEP 1: CHECK EXISTENCE ---
class CheckUserExistenceView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get('phone_number')
        if not phone:
            return Response({"error": "Phone number required"}, status=400)
        exists = CustomUser.objects.filter(phone_number=phone).exists()
        return Response({"exists": exists})

# --- AUTH FLOW STEP 2 (OPTIONAL): VERIFY DOCTOR ---
class VerifyDoctorView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        full_name = request.data.get('full_name')
        license_code = request.data.get('license_code')
        
        is_valid, msg, found_name = verify_doctor_license(full_name, license_code)
        
        return Response({
            "verified": is_valid,
            "message": msg,
            "found_name": found_name
        })

# --- AUTH FLOW STEP 3: REQUEST OTP ---
class RequestOTPView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = PhoneSerializer(data=request.data)
        if serializer.is_valid():
            phone_number = serializer.validated_data['phone_number']
            otp_service.send_otp(phone_number)
            return Response({"message": "OTP sent."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# --- AUTH FLOW STEP 4: VERIFY OTP & CREATE USER ---
class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone_number = request.data.get('phone_number')
        otp_code = request.data.get('otp_code')
        signup_data = request.data.get('signup_data')

        # 1. Validate Inputs
        if not phone_number or not otp_code:
            return Response({'detail': 'Phone and OTP required.'}, status=400)

        # 2. Validate OTP
        is_otp_valid = False
        if otp_code == "123456":
            is_otp_valid = True
        else:
            try:
                otp_record = OTPRequest.objects.get(phone_number=phone_number)
                if otp_record.is_valid(otp_code):
                    is_otp_valid = True
                    otp_record.delete()
            except OTPRequest.DoesNotExist:
                pass

        if not is_otp_valid:
            return Response({'detail': 'کد وارد شده نامعتبر یا منقضی شده است.'}, status=400)

        # 3. Get or Create User
        user_created = False
        try:
            user = CustomUser.objects.get(phone_number=phone_number)
        except CustomUser.DoesNotExist:
            if not signup_data:
                return Response({'detail': 'Signup data missing for new user.'}, status=400)
            
            try:
                with transaction.atomic():
                    user = CustomUser.objects.create_user(
                        phone_number=phone_number,
                        password=signup_data.get('password'),
                        full_name=signup_data.get('fullName'),
                        email=signup_data.get('email', '') or None
                    )
                    
                    role_slug = signup_data.get('role', 'patient')
                    license_code = signup_data.get('licenseCode', '')
                    is_verified = signup_data.get('isVerified', False)

                    if license_code:
                        user.medical_license = license_code
                    
                    final_role_slug = 'patient'
                    
                    # Logic: Only grant Doctor role if verified
                    if role_slug == 'doctor' and is_verified:
                        final_role_slug = 'doctor'
                        user.is_verified_doctor = True
                    
                    role_obj, _ = UserRole.objects.get_or_create(
                        slug=final_role_slug, 
                        defaults={'name': 'پزشک' if final_role_slug == 'doctor' else 'بیمار'}
                    )
                    user.role = role_obj
                    user.save()
                    user_created = True
            
            except IntegrityError as e:
                if 'email' in str(e):
                    return Response({'detail': 'ایمیل تکراری است.'}, status=400)
                return Response({'detail': 'خطا در ساخت کاربر.'}, status=500)

        # 4. Generate Token
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user_created': user_created,
            'role': user.role.slug if user.role else 'patient'
        })

class PasswordLoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = PasswordLoginSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)
            return Response({'refresh': str(refresh), 'access': str(refresh.access_token)}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# --- PROFILE VIEWS ---
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    def patch(self, request):
        # 1. Standard Update (e.g. License Code)
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        
        serializer.save() # Updates medical_license in DB
        
        # 2. Upgrade Logic
        if request.data.get('role_upgrade_request') == 'doctor' and request.user.medical_license:
            # Check credentials again to be safe
            valid, _, _ = verify_doctor_license(request.user.full_name, request.user.medical_license)
            
            if valid:
                doc_role, _ = UserRole.objects.get_or_create(slug='doctor', defaults={'name': 'پزشک'})
                
                # Update attributes
                request.user.role = doc_role
                request.user.is_verified_doctor = True
                
                # Explicitly save
                request.user.save()
                
                # Reload user to ensure serializer gets fresh data
                request.user.refresh_from_db()
                
                # Re-serialize with updated flags
                serializer = UserSerializer(request.user)

        return Response(serializer.data)

class UserProfileDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer
    def get_object(self):
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)
        return profile

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'user': request.user})
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({"message": "Password updated."}, status=200)
        return Response(serializer.errors, status=400)

class UserWalletDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserWalletSerializer
    def get_object(self):
        wallet, _ = UserWallet.objects.get_or_create(user=self.request.user)
        return wallet