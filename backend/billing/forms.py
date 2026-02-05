# backend/billing/forms.py
from django import forms
from .models import Transaction, BillingProduct, UserWallet

def format_initial_decimal(value):
    """Helper to convert 0E-10 to '0' and large scientific numbers to standard notation."""
    if value is None:
        return ""
    if value == 0:
        return "0"
    # Format as fixed-point string, then strip trailing zeros/point
    # This handles large numbers and small scientific notations gracefully
    s = "{:f}".format(value)
    if '.' in s:
        s = s.rstrip('0').rstrip('.')
    return s

class WalletAdjustmentForm(forms.Form):
    _selected_action = forms.CharField(widget=forms.MultipleHiddenInput)
    
    amount = forms.DecimalField(
        label="Amount (Credits)",
        help_text="Positive to ADD credits, Negative to DEDUCT credits.",
        decimal_places=2,
        required=True
    )
    
    type = forms.ChoiceField(
        label="Transaction Type",
        choices=[
            (Transaction.TransactionType.ADJUSTMENT, 'General Adjustment'),
            (Transaction.TransactionType.DEPOSIT, 'Manual Deposit (Bank Transfer)'),
        ],
        initial=Transaction.TransactionType.ADJUSTMENT,
        required=True
    )
    
    description = forms.CharField(
        label="Reason / Description",
        required=True, 
        widget=forms.Textarea(attrs={'rows': 3}),
        help_text="Reason for this adjustment (e.g. 'Support Ticket #123', 'Refund for failed gen')"
    )

class BillingProductAdminForm(forms.ModelForm):
    class Meta:
        model = BillingProduct
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            # Fix scientific notation for credit_amount
            self.initial['credit_amount'] = format_initial_decimal(self.instance.credit_amount)

class UserWalletAdminForm(forms.ModelForm):
    class Meta:
        model = UserWallet
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            # Fix scientific notation for wallet balances
            self.initial['balance_paid'] = format_initial_decimal(self.instance.balance_paid)
            self.initial['balance_plan'] = format_initial_decimal(self.instance.balance_plan)
            self.initial['daily_free_used'] = format_initial_decimal(self.instance.daily_free_used)