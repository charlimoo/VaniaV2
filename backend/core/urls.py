from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Django Admin Interface
    path('admin/', admin.site.urls),

    # Authentication & User Management
    path('api/auth/', include('users.urls')),

    # Billing, Payments & Marketplace
    path('api/billing/', include('billing.urls')),
    
    # Agent Services, Forms & Knowledge Base
    path('api/services/', include('services.urls')),
    
    # [FIX] Register Vania Clinical Core URLs
    path('api/vania/', include('vania_core.urls')),
]