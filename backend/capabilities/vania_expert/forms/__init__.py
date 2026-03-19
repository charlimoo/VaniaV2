# backend/capabilities/vania_doctor/forms/__init__.py

from capabilities.vania_visitor.forms import FORM_BASE_PROFILE
from .psychology import FORM_PSYCHOLOGY
from .family import FORM_FAMILY
from .marriage import FORM_MARRIAGE
from .matchmaking import FORM_MATCHMAKING
from .job import FORM_JOB
from .education import FORM_EDUCATION
from .psychiatry import FORM_PSYCHIATRY
from .social_work import FORM_SOCIAL

# Make sure to handle the naming if Psychiatry was reusing logic or had a typo in original file
# In your original file, FORM_PSYCHIATRY was defined correctly. 
# Ensure separate file backend/capabilities/vania_doctor/forms/psychiatry.py exists.

from .psychiatry import FORM_PSYCHIATRY

ALL_FORMS_LIST = [
    FORM_BASE_PROFILE, # The new one comes first!
    FORM_PSYCHOLOGY,
    FORM_FAMILY,
    FORM_MARRIAGE,
    FORM_MATCHMAKING,
    FORM_JOB,
    FORM_EDUCATION,
    FORM_PSYCHIATRY,
    FORM_SOCIAL
]
