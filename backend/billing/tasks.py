# backend/billing/tasks.py
import logging
from celery import shared_task
from django.db import transaction
from django.utils import timezone
from datetime import timedelta

# [FIX] Added Invoice to imports
from .models import UserWallet, BillingConfig, Invoice

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
    Run Daily (01:00 AM).
    Finds wallets where the plan has expired effectively.
    1. Removes the active_plan link.
    2. Resets balance_plan to 0 (Subscription credits expire).
    3. Preserves balance_paid (Top-ups never expire).
    """
    now = timezone.now()
    
    # Filter: Has a plan, AND expiry date is in the past
    expired_wallets = UserWallet.objects.filter(
        active_plan__isnull=False,
        plan_expires_at__lt=now
    )
    
    # Bulk update for efficiency
    updated_count = expired_wallets.update(
        active_plan=None,
        balance_plan=0  # Reset subscription credits
    )
    
    if updated_count > 0:
        logger.info(f"🧹 [Cleanup] Removed expired plans for {updated_count} wallets.")
        
    return f"Cleanup: Expired plans removed for {updated_count} wallets."

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