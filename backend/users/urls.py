# backend/users/urls.py
from django.urls import path
from .views import (
    RequestOTPView,
    VerifyOTPView,
    PasswordLoginView,
    UserProfileView,
    UserProfileDetailView,
    ChangePasswordView,
    UserWalletDetailView,
    CheckUserExistenceView, 
    VerifyDoctorView,
    ExpertProfessionListView,
    UpgradeExpertView,
)

urlpatterns = [
    # --- AUTH ---
    path('request-otp/', RequestOTPView.as_view(), name='request-otp'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('login/', PasswordLoginView.as_view(), name='password-login'),
    
    # --- PROFILE & CONTEXT ---
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('profile/agent/', UserProfileDetailView.as_view(), name='user-agent-profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),

    # --- WALLET ---
    path('wallet/', UserWalletDetailView.as_view(), name='user-wallet-detail'),
    
    path('check-exists/', CheckUserExistenceView.as_view(), name='check-user-exists'),
    path('verify-doctor/', VerifyDoctorView.as_view(), name='verify-doctor'),
    path('verify-expert/', VerifyDoctorView.as_view(), name='verify-expert'),
    path('expert-professions/', ExpertProfessionListView.as_view(), name='expert-professions'),
    path('upgrade-expert/', UpgradeExpertView.as_view(), name='upgrade-expert'),
]
