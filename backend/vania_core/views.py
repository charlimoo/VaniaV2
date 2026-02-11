# backend/vania_core/views.py
import logging
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
import json
from django.utils import timezone
# --- Vania Core Imports ---
from .services import (
    PatientManagementService, 
    RoadmapService, 
    AppendixService, 
    TaskService, 
    SessionService
)
from .models import (
    TreatmentConnection, 
    PatientInvite, 
    DoctorProfile, 
    Notification, 
    SecureMessage, 
    RoleVerificationRequest, 
    Location, 
)
from .permissions import IsDoctorUser, VaniaAccessControl
from .serializers import (
    # Existing Serializers
    InvitePatientSerializer, ConnectionListSerializer, RespondConnectionSerializer,
    PublicDoctorSerializer, AppointmentRequestSerializer, NotificationSerializer,
    SecureMessageSerializer, ConversationSerializer, RoleVerificationRequestSerializer,
    DoctorProfileUpdateSerializer, LocationSerializer,
    
    # New VCOS Serializers
    TherapyRoadmapSerializer, CulturalResourceSerializer, AddSessionSerializer
)

# --- User Imports ---
from users.models import CustomUser, UserContextEntry

# Configure logger for this module
logger = logging.getLogger(__name__)

# ==============================================================================
# == 1. PATIENT & DOCTOR MANAGEMENT VIEWS
# ==============================================================================

class DoctorInvitePatientView(APIView):
    """
    Handles a doctor's request to add a new patient to their roster.
    This is the entry point for the "Add Patient" modal.
    """
    permission_classes = [permissions.IsAuthenticated, IsDoctorUser]
    
    def post(self, request):
        serializer = InvitePatientSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            success, message, patient = PatientManagementService.invite_patient_by_phone(
                doctor_user=request.user, 
                phone_number=data['phone_number'], 
                full_name=data.get('full_name', '')
            )
            
            if success and patient:
                # Initialize the therapy roadmap for the new patient
                RoadmapService.get_or_create_roadmap(patient)
                
                return Response({
                    "message": message, 
                    "patient_id": patient.id,
                    "name": patient.full_name
                }, status=status.HTTP_201_CREATED)
                
            else: 
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DoctorDashboardPatientsView(APIView):
    """
    Provides a consolidated list of a doctor's active patients, pending requests,
    and sent invitations for their main dashboard and the patient selector dropdown.
    """
    permission_classes = [permissions.IsAuthenticated, IsDoctorUser]
    
    def get(self, request):
        user = request.user
        connections = TreatmentConnection.objects.filter(doctor=user, status__in=[TreatmentConnection.Status.ACTIVE, TreatmentConnection.Status.PENDING_PATIENT_APPROVAL]).select_related('patient')
        requests = TreatmentConnection.objects.filter(doctor=user, status=TreatmentConnection.Status.PENDING_DOCTOR_APPROVAL).select_related('patient')
        invites = PatientInvite.objects.filter(doctor=user, status=PatientInvite.InviteStatus.SENT)
        
        results = []
        for conn in connections:
            results.append({"id": f"conn_{conn.id}", "db_id": conn.id, "type": "CONNECTION", "patient_id": conn.patient.id, "name": conn.patient.full_name or "کاربر بدون نام", "phone": conn.patient.phone_number, "status": conn.status, "date": conn.created_at})
        for req in requests:
            results.append({"id": f"req_{req.id}", "db_id": req.id, "type": "REQUEST", "patient_id": req.patient.id, "name": req.patient.full_name or "کاربر بدون نام", "phone": req.patient.phone_number, "status": req.status, "date": req.created_at, "request_data": req.request_data})
        for inv in invites:
            results.append({"id": f"inv_{inv.id}", "db_id": inv.id, "type": "INVITE", "patient_id": None, "name": "کاربر دعوت شده", "phone": inv.phone_number, "status": "INVITED", "date": inv.created_at})
        
        results.sort(key=lambda x: x['date'], reverse=True)
        return Response(results)

class PublicDoctorListView(generics.ListAPIView):
    """Provides a list of public doctor profiles for the 'Find a Doctor' directory."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PublicDoctorSerializer
    
    def get_queryset(self):
        queryset = DoctorProfile.objects.filter(is_public=True).select_related('user', 'location')
        
        specialty = self.request.query_params.get('specialty')
        search = self.request.query_params.get('search')
        locations = self.request.query_params.getlist('locations')

        if locations and len(locations) == 1 and ',' in locations[0]:
             locations = locations[0].split(',')

        if locations:
            queryset = queryset.filter(location__id__in=locations)
        if specialty and specialty != 'ALL': 
            queryset = queryset.filter(specialty__icontains=specialty)
        if search: 
            queryset = queryset.filter(user__full_name__icontains=search)
            
        return queryset

class DoctorProfileView(APIView):
    """Allows a doctor to view and update their own professional profile."""
    permission_classes = [permissions.IsAuthenticated, IsDoctorUser]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = DoctorProfileUpdateSerializer

    def get(self, request):
        profile, _ = DoctorProfile.objects.get_or_create(user=request.user)
        serializer = self.serializer_class(profile, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        profile, _ = DoctorProfile.objects.get_or_create(user=request.user)
        serializer = self.serializer_class(profile, data=request.data, partial=True, context={'request': request})
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ==============================================================================
# == 2. CONNECTION & REQUEST MANAGEMENT VIEWS
# ==============================================================================

class RequestAppointmentView(APIView):
    """Endpoint for a patient to request an appointment with a doctor."""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, doctor_id):
        serializer = AppointmentRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        doctor_profile = get_object_or_404(DoctorProfile, pk=doctor_id)
        doctor_user = doctor_profile.user

        existing_conn = TreatmentConnection.objects.filter(doctor=doctor_user, patient=request.user).first()
        if existing_conn and existing_conn.status in [TreatmentConnection.Status.ACTIVE, TreatmentConnection.Status.PENDING_DOCTOR_APPROVAL]:
            return Response({"error": "You already have an active or pending connection with this doctor."}, status=400)

        form_data = serializer.validated_data
        TreatmentConnection.objects.create(
            doctor=doctor_user,
            patient=request.user,
            status=TreatmentConnection.Status.PENDING_DOCTOR_APPROVAL,
            request_data=form_data
        )

        Notification.objects.create(
            recipient=doctor_user, sender=request.user, type=Notification.Type.CONNECTION_REQUEST,
            title="درخواست نوبت جدید", message=f"بیمار {request.user.full_name} درخواست مشاوره ارسال کرده است.",
            payload={"url": "/dashboard/patients?tab=REQUESTS", "data": form_data}
        )

        return Response({"message": "درخواست شما برای پزشک ارسال شد."})

class PatientConnectionRequestsView(APIView):
    """Endpoint for a patient to view their pending connection requests from doctors."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        requests = TreatmentConnection.objects.filter(patient=request.user, status=TreatmentConnection.Status.PENDING_PATIENT_APPROVAL).select_related('doctor', 'doctor__doctor_profile')
        serializer = ConnectionListSerializer(requests, many=True, context={'request': request})
        return Response(serializer.data)

class RespondToConnectionView(APIView):
    """Endpoint for a patient to ACCEPT or REJECT a connection request."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, connection_id):
        connection = get_object_or_404(TreatmentConnection, id=connection_id, patient=request.user)
        serializer = RespondConnectionSerializer(data=request.data)
        if serializer.is_valid():
            action = serializer.validated_data['action']
            connection.status = TreatmentConnection.Status.ACTIVE if action == 'ACCEPT' else TreatmentConnection.Status.REJECTED
            connection.save()
            return Response({"message": f"Connection {action.lower()}ed."})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DoctorRespondToRequestView(APIView):
    """Endpoint for a doctor to ACCEPT or REJECT a connection request from a patient."""
    permission_classes = [permissions.IsAuthenticated, IsDoctorUser]

    def post(self, request, connection_id):
        connection = get_object_or_404(TreatmentConnection, id=connection_id, doctor=request.user, status=TreatmentConnection.Status.PENDING_DOCTOR_APPROVAL)
        serializer = RespondConnectionSerializer(data=request.data)
        if serializer.is_valid():
            action = serializer.validated_data['action']
            connection.status = TreatmentConnection.Status.ACTIVE if action == 'ACCEPT' else TreatmentConnection.Status.REJECTED
            connection.save()
            return Response({"message": f"Request {action.lower()}ed."})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ==============================================================================
# == 3. MESSAGING & NOTIFICATION VIEWS
# ==============================================================================

class NotificationListView(generics.ListAPIView):
    """Lists notifications for the currently authenticated user."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer
    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')

class MarkNotificationReadView(APIView):
    """Marks a single notification as read."""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
        if not notification.is_read:
            notification.is_read = True
            notification.save()
        return Response({"status": "read"})

class MarkAllNotificationsReadView(APIView):
    """Marks all of the user's unread notifications as read."""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"status": "success", "count": count})

class ConversationListView(APIView):
    """Provides a summary of all active messaging threads for the user's inbox."""
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        user = request.user
        connections = TreatmentConnection.objects.filter(Q(doctor=user) | Q(patient=user), status=TreatmentConnection.Status.ACTIVE).select_related('doctor', 'patient', 'doctor__doctor_profile')
        results = []
        for conn in connections:
            other = conn.patient if conn.doctor == user else conn.doctor
            role_label = "بیمار" if conn.doctor == user else "پزشک"
            
            try:
                profile = other.doctor_profile
            except DoctorProfile.DoesNotExist:
                profile = None
                
            specialty = profile.specialty if profile else ""
            avatar = None
            if profile and profile.avatar: 
                avatar = request.build_absolute_uri(profile.avatar.url)
            
            last_msg = SecureMessage.objects.filter(Q(sender=user, recipient=other) | Q(sender=other, recipient=user)).last()
            unread = SecureMessage.objects.filter(sender=other, recipient=user, is_read=False).count()
            results.append({"user_id": other.id, "name": other.full_name or other.phone_number,"phone_number": other.phone_number, "avatar": avatar, "role_label": role_label, "specialty": specialty, "last_message": last_msg.content if last_msg else "گفتگو را شروع کنید...", "last_message_date": last_msg.created_at if last_msg else conn.updated_at, "unread_count": unread})
        results.sort(key=lambda x: x['last_message_date'], reverse=True)
        serializer = ConversationSerializer(results, many=True)
        return Response(serializer.data)

class MessageThreadView(APIView):
    """Handles retrieving message history and sending new messages within a thread."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, other_user_id):
        messages = SecureMessage.objects.filter(Q(sender=request.user, recipient_id=other_user_id) | Q(sender_id=other_user_id, recipient=request.user))
        messages.filter(sender_id=other_user_id, is_read=False).update(is_read=True)
        serializer = SecureMessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, other_user_id):
        serializer = SecureMessageSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(sender=request.user, recipient_id=other_user_id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ==============================================================================
# == 4. VCOS 6-PHASE PROTOCOL API VIEWS
# ==============================================================================

class RoadmapView(APIView):
    """API endpoint for managing the Therapy Roadmap."""
    permission_classes = [permissions.IsAuthenticated, IsDoctorUser]

    def get(self, request):
        patient_id = request.query_params.get('patient_id')
        if not patient_id:
            return Response({"error": "'patient_id' query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        patient = get_object_or_404(CustomUser, pk=patient_id)
        if not VaniaAccessControl.verify_doctor_access(request.user, patient):
            return Response({"error": "Access denied to this patient's records."}, status=status.HTTP_403_FORBIDDEN)

        roadmap = RoadmapService.get_or_create_roadmap(patient)
        serializer = TherapyRoadmapSerializer(roadmap)
        return Response(serializer.data)

    def post(self, request):
        patient_id = request.data.get('patient_id')
        patient = get_object_or_404(CustomUser, pk=patient_id)
        
        serializer = AddSessionSerializer(data=request.data)
        if serializer.is_valid():
            new_session = RoadmapService.add_session(
                patient=patient, 
                title=serializer.validated_data['title'],
                instructions=serializer.validated_data.get('instructions', "")
            )
            return Response(new_session.model_dump(), status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AppendixView(APIView):
    """API endpoint for managing the Thought Appendix."""
    permission_classes = [permissions.IsAuthenticated, IsDoctorUser]

    def get(self, request):
        patient_id = request.query_params.get('patient_id')
        patient = get_object_or_404(CustomUser, pk=patient_id)
        if not VaniaAccessControl.verify_doctor_access(request.user, patient):
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
            
        library = AppendixService.get_library(patient)
        return Response(library.model_dump())

    def post(self, request):
        patient_id = request.data.get('patient_id')
        patient = get_object_or_404(CustomUser, pk=patient_id)
        
        serializer = CulturalResourceSerializer(data=request.data)
        if serializer.is_valid():
            new_resource = AppendixService.add_resource(patient, request.user, serializer.validated_data)
            return Response(new_resource.model_dump(), status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ActiveSessionView(APIView):
    """API endpoint to set which session is currently 'active' for the agent's context."""
    permission_classes = [permissions.IsAuthenticated, IsDoctorUser]

    def post(self, request):
        patient_id = request.data.get('patient_id')
        session_number = request.data.get('session_number')
        
        if not patient_id or session_number is None:
            return Response({"error": "Both 'patient_id' and 'session_number' are required."}, status=status.HTTP_400_BAD_REQUEST)

        patient = get_object_or_404(CustomUser, pk=patient_id)
        if not VaniaAccessControl.verify_doctor_access(request.user, patient):
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            RoadmapService.set_active_session(patient, int(session_number))
            return Response({"status": "updated", "active_session": session_number})
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

# ==============================================================================
# == 5. OTHER UTILITY/CRUD VIEWS
# ==============================================================================

class TaskManagementView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDoctorUser]
    
    def post(self, request):
        patient_id = request.data.get('patient_id')
        text = request.data.get('text')
        due_date = request.data.get('due_date')
        patient = get_object_or_404(CustomUser, pk=patient_id)
        
        if not VaniaAccessControl.verify_doctor_access(request.user, patient): 
            return Response({"error": "Access denied"}, status=403)
            
        new_task = TaskService.assign_task(patient, request.user, text, due_date)
        return Response(new_task, status=status.HTTP_201_CREATED)
    
    def put(self, request, task_id):
        patient_id = request.data.get('patient_id')
        text = request.data.get('text')
        due_date = request.data.get('due_date')
        patient = get_object_or_404(CustomUser, pk=patient_id)
        
        if not VaniaAccessControl.verify_doctor_access(request.user, patient): 
            return Response({"error": "Access denied"}, status=403)
            
        success = TaskService.edit_task(patient, task_id, text, due_date)
        if success:
            return Response({"status": "updated"})
        return Response({"error": "Task not found"}, status=404)
    
    def delete(self, request, task_id):
        patient_id = request.query_params.get('patient_id') 
        patient = get_object_or_404(CustomUser, pk=patient_id)
        
        if not VaniaAccessControl.verify_doctor_access(request.user, patient): 
            return Response({"error": "Access denied"}, status=403)
            
        success = TaskService.delete_task(patient, task_id)
        if success:
            return Response({"status": "deleted"})
        return Response({"error": "Task not found"}, status=404)
    
    
class SessionManagementView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDoctorUser]
    
    def post(self, request):
        patient_id = request.data.get('patient_id')
        summary = request.data.get('summary')
        private_notes = request.data.get('private_notes', '')
        # date_str = request.data.get('date') # Not used in current service signature
        patient = get_object_or_404(CustomUser, pk=patient_id)
        
        if not VaniaAccessControl.verify_doctor_access(request.user, patient): 
            return Response({"error": "Access denied"}, status=403)
            
        SessionService.log_session(patient, request.user, summary, private_notes)
        return Response({"status": "created"}, status=status.HTTP_201_CREATED)
    
    def put(self, request, entry_id):
        summary = request.data.get('summary')
        private_notes = request.data.get('private_notes', '')
        date = request.data.get('date')
        
        success = SessionService.update_session(entry_id, request.user, summary, private_notes, date)
        if success:
            return Response({"status": "updated"})
        return Response({"error": "Update failed"}, status=400)
    
    def delete(self, request, entry_id):
        success = SessionService.delete_session(entry_id, request.user)
        if success:
            return Response({"status": "deleted"})
        return Response({"error": "Delete failed"}, status=400)

class CompleteTaskView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, task_id):
        # Determine target patient based on Role
        target_patient = request.user
        
        # Check if Doctor is acting on behalf of a patient
        if hasattr(request.user, 'role') and request.user.role and request.user.role.slug == 'doctor':
            patient_id = request.data.get('patient_id')
            if patient_id:
                target_patient = get_object_or_404(CustomUser, pk=patient_id)
                # Verify permission
                if not VaniaAccessControl.verify_doctor_access(request.user, target_patient):
                    return Response({"error": "Access denied to this patient."}, status=status.HTTP_403_FORBIDDEN)
        
        reflection = request.data.get('reflection', "") 
        new_status = request.data.get('status', 'DONE') 

        success = TaskService.update_task_status(
            patient=target_patient, 
            task_id=task_id, 
            status=new_status, 
            reflection=reflection
        )
        
        if not success: 
            return Response({"error": "Task not found."}, status=status.HTTP_404_NOT_FOUND)
        
        return Response({"status": "success"})
    
class RoleVerificationRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        role_id = request.data.get('target_role_id')
        if RoleVerificationRequest.objects.filter(user=request.user, target_role_id=role_id, status__in=[RoleVerificationRequest.Status.PENDING, RoleVerificationRequest.Status.APPROVED]).exists():
            return Response({"error": "You already have a pending or active request for this role."}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = RoleVerificationRequestSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response({"message": "Request submitted successfully."}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LocationListView(generics.ListAPIView):
    """Publicly accessible list of locations for filtering doctors."""
    permission_classes = [permissions.AllowAny]
    queryset = Location.objects.all().order_by('name')
    serializer_class = LocationSerializer
    
class SessionReportView(APIView):
    """
    Allows a doctor to manually create or update the 'Session Support Document' 
    (Summary, Flashcards, etc.) for a specific session number.
    """
    permission_classes = [permissions.IsAuthenticated, IsDoctorUser]

    def post(self, request):
        patient_id = request.data.get('patient_id')
        session_number = request.data.get('session_number')
        
        # Report Data
        summary = request.data.get('summary', '')
        private_notes = request.data.get('private_notes', '')
        flashcards = request.data.get('flashcards', []) # List of {title, content}
        
        if not patient_id or session_number is None:
            return Response({"error": "Patient ID and Session Number required."}, status=400)

        patient = get_object_or_404(CustomUser, pk=patient_id)
        if not VaniaAccessControl.verify_doctor_access(request.user, patient):
            return Response({"error": "Access denied."}, status=403)

        # 1. Get Roadmap to check if session exists and if it has a doc_id
        roadmap = RoadmapService.get_or_create_roadmap(patient)
        target_session = next((s for s in roadmap.sessions if s.session_number == int(session_number)), None)
        
        if not target_session:
            return Response({"error": "Session not found in roadmap."}, status=404)

        # 2. Prepare Payload (Structured JSON)
        # We merge with existing data if we are updating, to not lose other AI generated fields
        rich_payload = {
            "is_structured_report": True,
            "session_number": int(session_number),
            "date": request.data.get('date') or timezone.now().strftime('%Y-%m-%d'),
            "topic": target_session.title,
            "symptoms_analysis": summary, # This maps to the main summary
            "flashcards": flashcards,
            # We preserve existing smart_goals/swot if we are just editing the text
        }

        log_entry = None

        # 3. Update Existing or Create New
        if target_session.doc_id:
            try:
                log_entry = UserContextEntry.objects.get(pk=target_session.doc_id)
                
                # Merge existing data so we don't wipe SWOT/Goals if they exist
                current_data = log_entry.data if isinstance(log_entry.data, dict) else {}
                current_data.update(rich_payload)
                
                log_entry.data = current_data
                log_entry.data['summary'] = json.dumps(current_data, ensure_ascii=False) # Keep summary field compatible
                log_entry.data['private_notes'] = private_notes
                log_entry.save()
            except UserContextEntry.DoesNotExist:
                # Fallback to create new if ID was bad
                pass

        if not log_entry:
            # Create new log
            log_entry = SessionService.log_session(
                patient=patient,
                doctor=request.user,
                summary=json.dumps(rich_payload, ensure_ascii=False),
                private_notes=private_notes
            )

        # 4. Ensure Roadmap is updated (Status -> COMPLETED, Link Doc ID)
        RoadmapService.complete_session(patient, int(session_number), str(log_entry.id))
        
        # 5. Fetch updated states to return for UI Sync
        updated_roadmap = RoadmapService.get_or_create_roadmap(patient)
        updated_history = SessionService.get_patient_history(patient, viewer_role='DOCTOR')

        return Response({
            "status": "success", 
            "roadmap": updated_roadmap.model_dump(),
            "history": updated_history
        })