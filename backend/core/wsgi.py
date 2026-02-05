"""
WSGI config for the core project.

It exposes the WSGI callable as a module-level variable named ``application``.

This file is configured to use WhiteNoise to serve both static and media files.
"""

import os
from django.core.wsgi import get_wsgi_application
from django.conf import settings
from whitenoise import WhiteNoise

# Set the Django settings module for the 'wsgi' application.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# Get the standard Django WSGI application.
application = get_wsgi_application()

# --- WHITENOISE CONFIGURATION ---
# Wrap the Django application with WhiteNoise.
# This will serve files from STATIC_ROOT under the STATIC_URL prefix.
application = WhiteNoise(application, root=settings.STATIC_ROOT)

# Add the user-uploaded media files.
# This tells WhiteNoise to also serve files from MEDIA_ROOT under the MEDIA_URL prefix.
application.add_files(settings.MEDIA_ROOT, prefix=settings.MEDIA_URL)