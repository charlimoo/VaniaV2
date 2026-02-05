# django_core/users/backends.py

from django.contrib.auth.backends import ModelBackend
from .models import CustomUser

class PhoneNumberBackend(ModelBackend):
    """
    Custom authentication backend to allow users to log in using their
    phone number and password.
    """
    def authenticate(self, request, phone_number=None, password=None, **kwargs):
        """
        Overrides the default authenticate method to use 'phone_number'
        instead of 'username'.
        """
        
        # FIX: The Admin panel sends 'username', so we must check kwargs for it.
        if phone_number is None:
            phone_number = kwargs.get('username')
            
        try:
            # Find a user with the provided phone number.
            user = CustomUser.objects.get(phone_number=phone_number)
            
            # Check if the provided password is valid for that user.
            # `check_password` handles the hashing and comparison securely.
            if user.check_password(password):
                return user
        except CustomUser.DoesNotExist:
            # Run the default password hasher once to reduce the effectiveness
            # of timing attacks against user enumeration.
            CustomUser().set_password(password)
            return None

    def get_user(self, user_id):
        """
        Overrides the get_user method to retrieve a user by their primary key.
        This is used by Django's session management to get the user object
        for a request.
        """
        try:
            return CustomUser.objects.get(pk=user_id)
        except CustomUser.DoesNotExist:
            return None