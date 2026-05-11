# backend/core/celery.py
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# --- CELERY BEAT SCHEDULE ---
app.conf.beat_schedule = {
    # 1. Reset Daily Free Credits (Every Midnight)
    'reset-daily-free-credits': {
        'task': 'billing.tasks.reset_daily_free_credits',
        'schedule': crontab(hour=0, minute=0),
    },
    'cancel-stale-invoices': {  # [NEW]
        'task': 'billing.tasks.cancel_stale_invoices',
        'schedule': crontab(hour=2, minute=0),
    },
    
    # --- SERVICES / NOTIFICATIONS ---
    'reset-stuck-documents': { # [NEW] Run hourly
        'task': 'services.tasks.reset_stuck_documents',
        'schedule': crontab(minute=30), # Run at XX:30 every hour
    },
}
