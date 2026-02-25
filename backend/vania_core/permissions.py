# start of backend/vania_core/permissions.py
from rest_framework import permissions
from .models import TreatmentConnection
from users.roles import is_expert

class VaniaAccessControl:
    """
    Centralized logic for checking relationship permissions.
    Used by Views (API) and Agent Tools (Backend Logic) to ensure consistency.
    """

    @staticmethod
    def verify_doctor_access(doctor, patient) -> bool:
        """
        Returns True if an ACTIVE connection exists between the doctor and patient.
        This is the "Golden Rule" for data access in Vania.
        """
        if not doctor or not patient:
            return False
            
        return TreatmentConnection.objects.filter(
            doctor=doctor,
            patient=patient,
            status=TreatmentConnection.Status.ACTIVE
        ).exists()

    @staticmethod
    def verify_patient_access(patient, doctor) -> bool:
        """
        Returns True if the patient is connected to the doctor (Active).
        Symmetric to doctor access, but semantic separation allows future divergence.
        """
        return VaniaAccessControl.verify_doctor_access(doctor, patient)


# --- DRF Permission Classes (For API Views) ---

class IsDoctorUser(permissions.BasePermission):
    """
    API Permission: Checks if the user explicitly holds the 'doctor' role.
    Used for endpoints like 'My Patients' or 'Invite Patient'.
    """
    def has_permission(self, request, view):
        # [FIX] Changed from .roles.filter(...) to .role checking
        if not request.user.is_authenticated:
            return False
            
        return is_expert(request.user)

class HasActiveConnection(permissions.BasePermission):
    """
    API Permission: Ensures the requestor is connected to the target object.
    
    This permission assumes the View class implements a `get_target_user()` method
    or provides the target object in a way we can inspect.
    
    Commonly used on DetailViews where an object ID is in the URL.
    """
    def has_object_permission(self, request, view, obj):
        # 1. If obj is a TreatmentConnection, check participants directly
        if isinstance(obj, TreatmentConnection):
            return obj.doctor == request.user or obj.patient == request.user
            
        # 2. If obj is a User (e.g. retrieving profile), check connection
        # This part requires context about "who" the target is, usually handled in the View's queryset.
        # But for object-level permission, we default to False unless explicit logic exists.
        return False
# end of backend/vania_core/permissions.py
