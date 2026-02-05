from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import F
from .models import Invoice, DiscountCode
from .services import FulfillmentService

@receiver(post_save, sender=Invoice)
def on_invoice_paid(sender, instance: Invoice, created: bool, **kwargs):
    """
    Listens for an Invoice's status changing to PAID.
    Triggers fulfillment and updates discount code usage.
    """
    # Trigger only on state change to PAID, not on creation
    if not created and instance.status == Invoice.Status.PAID:
        
        # 1. Atomic deduction from discount fund if applicable
        if instance.discount_code and instance.discount_amount > 0:
            DiscountCode.objects.filter(pk=instance.discount_code.pk).update(
                used_fund=F('used_fund') + instance.discount_amount
            )

        # 2. Grant credits or licenses to the user
        FulfillmentService.execute(instance)