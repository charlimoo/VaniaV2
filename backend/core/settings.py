import os
from pathlib import Path
from datetime import timedelta
import warnings
from dotenv import load_dotenv
import dj_database_url
import urllib.parse
import sys
# --- 1. PATHS & ENV SETUP ---
# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
load_dotenv(BASE_DIR / '.env')

# --- 2. CORE DJANGO SETTINGS ---
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-me-in-production')

# Default to False in production for security
DEBUG = os.getenv('DEBUG', 'False').lower() in ('true', '1', 't')

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,0.0.0.0').split(',')

# --- 3. APPLICATION DEFINITION ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'whitenoise.runserver_nostatic', # Static file serving
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_jsonform',
    'django_filters',
    'storages',  # For MinIO/S3 support

    # Custom apps
    'users.apps.UsersConfig',
    'billing.apps.BillingConfig',
    'services.apps.ServicesConfig',

    'vania_core.apps.VaniaCoreConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware', # Optimised static files
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware', # CORS must be before Common
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# --- 4. DATABASE (PostgreSQL) ---
# Looks for 'DATABASE_URL' in env. Defaults to SQLite if not found (fallback).
DEFAULT_DB_URL = f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
DATABASE_URL = os.getenv('DATABASE_URL', DEFAULT_DB_URL)
DB_CONN_MAX_AGE = int(os.getenv('DB_CONN_MAX_AGE', '0'))
DB_CONN_HEALTH_CHECKS = os.getenv('DB_CONN_HEALTH_CHECKS', 'True').lower() in ('true', '1', 't')

DATABASES = {
    'default': dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=DB_CONN_MAX_AGE,
        conn_health_checks=DB_CONN_HEALTH_CHECKS,
    ),
}

# --- 5. AGNO / SQLALCHEMY CONNECTION STRING ---
# Used by the Agent Runtime (FastAPI) to connect to the same DB.
db_conf = DATABASES['default']

if db_conf['ENGINE'] == 'django.db.backends.sqlite3':
    # SQLite format: sqlite:///path/to/db.sqlite3
    DATABASE_CONNECTION_STRING = f"sqlite:///{db_conf['NAME']}"
else:
    # Postgres format: postgresql+psycopg://user:pass@host:port/dbname
    # URL encode password to handle special characters safely
    encoded_password = urllib.parse.quote_plus(db_conf['PASSWORD'])
    DATABASE_CONNECTION_STRING = (
        f"postgresql+psycopg://{db_conf['USER']}:{encoded_password}"
        f"@{db_conf['HOST']}:{db_conf['PORT']}/{db_conf['NAME']}"
    )

# --- 6. FILE STORAGE (MinIO / S3) ---
# Controls where uploads (PDFs, Images) are stored.
USE_S3 = os.getenv('USE_S3', 'False').lower() == 'true'

if USE_S3:
    # --- PROD / DOCKER DEV (MinIO) ---
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
    
    # 1. Internal URL (For backend API -> MinIO communication)
    AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL') 
    
    # 2. NEW: External Domain (For Browser -> MinIO)
    AWS_S3_CUSTOM_DOMAIN = os.getenv('AWS_S3_CUSTOM_DOMAIN') 

    AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
    AWS_S3_SIGNATURE_VERSION = 's3v4'
    AWS_QUERYSTRING_AUTH = False

    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            # Pass custom domain to the storage backend
            "OPTIONS": {
                "custom_domain": AWS_S3_CUSTOM_DOMAIN,
            }
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

    # 3. Construct Media URL based on Public Domain if available, else fallback
    if AWS_S3_CUSTOM_DOMAIN:
        MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/{AWS_STORAGE_BUCKET_NAME}/'
    elif AWS_S3_ENDPOINT_URL:
        MEDIA_URL = f'{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/'
    else:
        MEDIA_URL = f'https://{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com/'

else:
    # --- LOCAL FALLBACK (Disk) ---
    MEDIA_URL = '/media/'
    MEDIA_ROOT = BASE_DIR / 'media'
    
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

# --- 7. VECTOR DATABASE (Qdrant) ---
# Used for RAG and Long-term Memory
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333") 
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", None)

# --- 8. CELERY & REDIS ---
# Controls background tasks and Caching
USE_CELERY = os.getenv('USE_CELERY', 'True').lower() == 'true'
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CACHE_URL = os.getenv('CACHE_URL', '').strip()
if not CACHE_URL and 'REDIS_URL' in os.environ:
    CACHE_URL = os.environ['REDIS_URL'].strip()

if CACHE_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': CACHE_URL,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'vania-local-cache',
        }
    }
    if not DEBUG:
        warnings.warn(
            "CACHE_URL is not set; falling back to LocMemCache. "
            "OTP verification, throttling, and other cache-backed flows will break across multiple app workers.",
            RuntimeWarning,
        )

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TIMEZONE = 'UTC'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# --- 9. AUTHENTICATION ---
AUTH_USER_MODEL = 'users.CustomUser'
AUTHENTICATION_BACKENDS = [
    'users.backends.PhoneNumberBackend', # Login via Phone
    'django.contrib.auth.backends.ModelBackend',
]

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'users.password_validators.StrongPasswordValidator'},
]

# JWT Settings
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", 300))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", 7))),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# DRF Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': os.getenv('DRF_THROTTLE_ANON', '60/min'),
        'user': os.getenv('DRF_THROTTLE_USER', '300/min'),
        'request_otp': os.getenv('DRF_THROTTLE_REQUEST_OTP', '10/min'),
        'verify_otp': os.getenv('DRF_THROTTLE_VERIFY_OTP', '10/min'),
        'password_login': os.getenv('DRF_THROTTLE_PASSWORD_LOGIN', '10/min'),
    }
}

# --- 10. STATIC FILES ---
STATIC_URL = 'static/'

if 'win' in sys.platform:
    # Local Windows (non-docker) fallback
    STATIC_ROOT = BASE_DIR / 'staticfiles'
else:
    # Docker / Linux path (Fast I/O)
    STATIC_ROOT = '/tmp/staticfiles'

# --- 11. INTERNATIONALIZATION ---
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Tehran'
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'



# --- 12. CUSTOM CONFIGURATION ---

LANGFUSE_ENABLED = os.getenv("LANGFUSE_ENABLED", "True") == "True"
LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY")
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "https://us.cloud.langfuse.com")

# Payment Gateway
ZARINPAL_MERCHANT_ID = os.getenv("ZARINPAL_MERCHANT_ID")
ZARINPAL_SANDBOX = DEBUG and not ZARINPAL_MERCHANT_ID # Auto-sandbox in debug
ENABLE_ZARINPAL = os.getenv("ENABLE_ZARINPAL", "False").lower() in ("true", "1", "t")
ZIBAL_MERCHANT_ID = os.getenv("ZIBAL_MERCHANT_ID", "zibal" if DEBUG else "")

# Domain & Redirects
API_DOMAIN = os.getenv("API_DOMAIN", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
APP_URL = os.getenv("APP_URL", FRONTEND_URL)

# SMS Providers
SMS_SERVICE_MODE = os.getenv("SMS_SERVICE_MODE", "CONSOLE")
SMSIR_API_KEY = os.getenv("SMSIR_API_KEY")
SMSIR_TEMPLATE_ID = os.getenv("SMSIR_TEMPLATE_ID", "100000")
SMSIR_PARAMETER_NAME = os.getenv("SMSIR_PARAMETER_NAME", "Code")
NAJVA_API_KEY = os.getenv("NAJVA_API_KEY")
NAJVA_SENDER_ID = os.getenv("NAJVA_SENDER_ID")

# OpenAI (Required for RAG Embeddings/Agno)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")
OPENAI_TIMEOUT_SECONDS = os.getenv("OPENAI_TIMEOUT_SECONDS")
AI_PROVIDER = os.getenv("AI_PROVIDER", "openai")
GAPGPT_API_KEY = os.getenv("GAPGPT_API_KEY")
GAPGPT_BASE_URL = os.getenv("GAPGPT_BASE_URL", "https://api.gapgpt.app/v1")
GAPGPT_TIMEOUT_SECONDS = os.getenv("GAPGPT_TIMEOUT_SECONDS", "300")
AI_TIMEOUT_SECONDS = os.getenv("AI_TIMEOUT_SECONDS")
AI_TRANSCRIBE_MODEL = os.getenv("AI_TRANSCRIBE_MODEL", "whisper-1")

LANCEDB_URI = "/tmp/lancedb"

# --- 13. CORS ---
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',')
CORS_ALLOW_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "origin",
    "x-csrftoken",
    "x-requested-with",
    "x-reasoning-effort",
    "x-target-resource-id",
    "x-target-expert-id",
    "x-target-doctor-id",
    "x-target-case-id",
    "x-enable-reasoning",
]

CSRF_TRUSTED_ORIGINS = os.getenv('CSRF_TRUSTED_ORIGINS', 'http://localhost:8000').split(',')

# --- 14. AUTH REDIRECTS ---
# Redirect non-logged-in users to the Admin login page
LOGIN_URL = '/admin/login/'
LOGIN_REDIRECT_URL = '/tradeintel/create/'



LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,  # Keep logs from other libraries

    # How to format the log messages
    "formatters": {
        "verbose": {
            # Example: [INFO] 2025-12-11 23:45:00 | agents.factory | Final Reasoning Params...
            "format": "[{levelname}] {asctime} | {name} | {message}",
            "style": "{",
        },
    },

    # Where to send the logs
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },

    # Which loggers to configure
    "loggers": {
        # The "root" logger catches everything not explicitly defined below.
        "": {
            "handlers": ["console"],
            "level": "INFO",
        },

        # --- Our Application Loggers ---
        # Set to DEBUG to see everything from our own code during development.
        "agents": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False, # Don't send these to the root logger too
        },
        "capabilities": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
        "services": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
        "agno": {  # To see logs from the agent framework if needed
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },

        # --- Third-Party Loggers ---
        # Keep noisy libraries at INFO level.
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "uvicorn": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}




# if DEBUG:
#     # VERBOSE LOGGING FOR DEVELOPMENT
#     # When DEBUG is True, we want to see everything. This configuration provides
#     # detailed output from our own applications ('agents', 'services', etc.)
#     # while keeping third-party libraries at a manageable INFO level.
#     LOGGING = {
#         "version": 1,
#         "disable_existing_loggers": False,  # Keep logs from other libraries

#         # How to format the log messages
#         "formatters": {
#             "verbose": {
#                 # Example: [INFO] 2025-12-11 23:45:00 | agents.factory | Final Reasoning Params...
#                 "format": "[{levelname}] {asctime} | {name} | {message}",
#                 "style": "{",
#             },
#         },

#         # Where to send the logs
#         "handlers": {
#             "console": {
#                 "class": "logging.StreamHandler",
#                 "formatter": "verbose",
#             },
#         },

#         # Which loggers to configure
#         "loggers": {
#             # The "root" logger catches everything not explicitly defined below.
#             "": {
#                 "handlers": ["console"],
#                 "level": "INFO",
#             },

#             # --- Our Application Loggers ---
#             # Set to DEBUG to see everything from our own code during development.
#             "agents": {
#                 "handlers": ["console"],
#                 "level": "DEBUG",
#                 "propagate": False, # Don't send these to the root logger too
#             },
#             "capabilities": {
#                 "handlers": ["console"],
#                 "level": "DEBUG",
#                 "propagate": False,
#             },
#             "services": {
#                 "handlers": ["console"],
#                 "level": "DEBUG",
#                 "propagate": False,
#             },
#             "agno": {  # To see logs from the agent framework if needed
#                 "handlers": ["console"],
#                 "level": "DEBUG",
#                 "propagate": False,
#             },

#             # --- Third-Party Loggers ---
#             # Keep noisy libraries at INFO level.
#             "django": {
#                 "handlers": ["console"],
#                 "level": "INFO",
#                 "propagate": False,
#             },
#             "uvicorn": {
#                 "handlers": ["console"],
#                 "level": "INFO",
#                 "propagate": False,
#             },
#             "celery": {
#                 "handlers": ["console"],
#                 "level": "INFO",
#                 "propagate": False,
#             },
#         },
#     }
# else:
#     # MINIMAL LOGGING FOR PRODUCTION
#     # When DEBUG is False, we only want to see necessary information and errors.
#     # This configuration simplifies the output and reduces noise.
#     LOGGING = {
#         "version": 1,
#         "disable_existing_loggers": False,

#         # A simpler formatter for production logs
#         "formatters": {
#             "simple": {
#                 "format": "[{levelname}] {name}: {message}",
#                 "style": "{",
#             },
#         },

#         # Logs will still be sent to the console
#         "handlers": {
#             "console": {
#                 "class": "logging.StreamHandler",
#                 "formatter": "simple",
#             },
#         },
        
#         # Configure loggers for minimal output
#         "loggers": {
#             # The root logger is the primary configuration.
#             # It will show INFO, WARNING, ERROR, and CRITICAL messages
#             # for all applications by default.
#             "": {
#                 "handlers": ["console"],
#                 "level": "INFO",
#             },
            
#             # Django's own logs are important, so we keep them at INFO.
#             # You might raise this to "WARNING" for an even quieter log.
#             "django": {
#                 "handlers": ["console"],
#                 "level": "INFO",
#                 "propagate": False,
#             },
#         },
#     }


NAJVA_API_KEY = os.getenv("NAJVA_API_KEY")
NAJVA_SENDER_ID = os.getenv("NAJVA_SENDER_ID")
# Mode: 'LIVE' (Sends real SMS), 'CONSOLE' (Prints to stdout for dev)
SMS_SERVICE_MODE = os.getenv("SMS_SERVICE_MODE", "CONSOLE")

APP_NAME = "Vania"

