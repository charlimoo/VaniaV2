# backend/billing/tasks.py
import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

# [FIX] Added Invoice to imports
from .models import UserWallet, Invoice

logger = logging.getLogger("celery.billing")

@shared_task(name="billing.tasks.reset_daily_free_credits")
def reset_daily_free_credits():
    """
    Run Daily (Midnight).
    Resets the 'daily_free_used' counter to 0 for all active wallets.
    """
    updated_count = UserWallet.objects.filter(daily_free_used__gt=0).update(daily_free_used=0)
    return f"Daily Reset: Reset usage for {updated_count} wallets."

@shared_task(name="billing.tasks.clean_expired_plans")
def clean_expired_plans():
    """
    Deprecated no-op retained for compatibility with older Celery Beat entries.
    Plan ownership and plan credits no longer expire by time.
    """
    logger.info("Skipping legacy clean_expired_plans task because plan expiry is disabled.")
    return "Cleanup skipped: plans no longer expire."

@shared_task(name="billing.tasks.cancel_stale_invoices")
def cancel_stale_invoices():
    """
    Run Daily (02:00 AM).
    Cancels invoices that have been PENDING for more than 24 hours.
    This keeps the ledger clean and invalidates old payment links.
    """
    # Threshold: 24 hours ago
    threshold = timezone.now() - timedelta(hours=24)
    
    stale_invoices = Invoice.objects.filter(
        status=Invoice.Status.PENDING,
        created_at__lt=threshold
    )
    
    count = stale_invoices.update(status=Invoice.Status.CANCELLED)
    
    if count > 0:
        logger.info(f"🗑️ [Billing] Cancelled {count} stale invoices.")
        
    return f"Cancelled {count} stale invoices."
