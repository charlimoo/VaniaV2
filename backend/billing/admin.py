# backend/billing/admin.py
from django.contrib import admin
from django.db import transaction
from django.contrib import messages
from django.utils.html import format_html

from .models import BillingConfig, UserWallet, Transaction, BillingProduct, Invoice, DiscountCode, SubscriptionPlan, FAQ
from .forms import WalletAdjustmentForm, BillingProductAdminForm, UserWalletAdminForm, format_initial_decimal

@admin.register(BillingConfig)
class BillingConfigAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Display Settings', {
            'fields': ('currency_name', 'currency_symbol')
        }),
        ('Support Contact Info', {
            'fields': ('support_phone', 'support_email', 'support_address', 'support_postal_code', 'support_contacts'),
            'description': 'Visible in the Support Page and Footer.'
        }),
        ('Economy Logic', {
            'fields': ('tokens_per_credit', 'daily_free_credits', 'transcription_cost_per_minute'),
        }),
        ('Manual Payment', {
            'fields': ('bank_card_number', 'bank_holder_name', 'manual_payment_tips'),
        }),
    )
    
@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ('question', 'category', 'order', 'is_active')
    list_editable = ('order', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('question', 'answer')
    
@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'price', 'included_credits', 'is_active')
    search_fields = ('name', 'slug')
    list_filter = ('is_active',)
    
    # All fields are now editable.
    readonly_fields = ()
    
    fieldsets = (
        (None, {
            'fields': ('name', 'slug', 'description', 'is_active')
        }),
        ('Pricing & Economy', {
            'fields': ('price', 'included_credits'),
            'description': "Define the cost (Toman) and the credits (Coins) given."
        }),
    )

@admin.register(BillingProduct)
class BillingProductAdmin(admin.ModelAdmin):
    form = BillingProductAdminForm
    list_display = ('name', 'price', 'type_label', 'get_clean_credits', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)
    
    def type_label(self, obj):
        return "Plan" if obj.linked_plan else "Top-up"
    type_label.short_description = "Type"

    def get_clean_credits(self, obj):
        return format_initial_decimal(obj.credit_amount)
    get_clean_credits.short_description = "Credit Amount"

@admin.register(UserWallet)
class UserWalletAdmin(admin.ModelAdmin):
    form = UserWalletAdminForm
    list_display = ('user_info', 'active_plan', 'get_clean_total', 'updated_at')
    search_fields = ('user__phone_number', 'user__email', 'user__full_name')
    readonly_fields = ('updated_at', 'get_clean_total_ro')
    actions = ['apply_manual_adjustment']

    fieldsets = (
        ('Owner', {
            'fields': ('user',)
        }),
        ('Plan Status', {
            'fields': ('active_plan',)
        }),
        ('Balances', {
            'fields': ('balance_paid', 'balance_plan', 'daily_free_used'),
            'description': "These fields accept decimals. Scientific notation (e.g., 0E-10) is auto-cleaned on load."
        }),
        ('Meta', {
            'fields': ('updated_at', 'get_clean_total_ro')
        })
    )

    def user_info(self, obj):
        return f"{obj.user.phone_number} ({obj.user.full_name or '-'})"
    user_info.short_description = "User"

    def get_clean_total(self, obj):
        return format_initial_decimal(obj.total_balance)
    get_clean_total.short_description = "Total Balance"

    def get_clean_total_ro(self, obj):
        return format_initial_decimal(obj.total_balance)
    get_clean_total_ro.short_description = "Total Balance (Calculated)"

    @admin.action(description="⚖️ Apply Manual Adjustment")
    def apply_manual_adjustment(self, request, queryset):
        if 'apply' in request.POST:
            form = WalletAdjustmentForm(request.POST)
            if form.is_valid():
                amount = form.cleaned_data['amount']
                desc = form.cleaned_data['description']
                trans_type = form.cleaned_data['type']
                
                count = 0
                with transaction.atomic():
                    for wallet in queryset:
                        wallet.balance_paid += amount
                        wallet.save()
                        
                        Transaction.objects.create(
                            wallet=wallet,
                            amount=amount,
                            transaction_type=trans_type,
                            description=f"[Admin: {request.user}] {desc}"
                        )
                        count += 1
                
                self.message_user(request, f"Successfully adjusted {count} wallets.", messages.SUCCESS)
                return None 
        
        else:
            form = WalletAdjustmentForm(initial={
                '_selected_action': queryset.values_list('pk', flat=True)
            })

        return admin.helpers.render_form_view(request, form, queryset, self.model)

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'wallet_link', 'get_clean_amount', 'transaction_type', 'description')
    list_filter = ('transaction_type', 'timestamp')
    search_fields = ('wallet__user__phone_number', 'description', 'reference_id')
    
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False

    def wallet_link(self, obj):
        return format_html('<a href="/admin/billing/userwallet/{}/change/">{}</a>', obj.wallet.id, obj.wallet.user)
    wallet_link.short_description = "Wallet"

    def get_clean_amount(self, obj):
        return format_initial_decimal(obj.amount)
    get_clean_amount.short_description = "Amount"

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'total_amount', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('id', 'user__phone_number', 'transaction_ref_id')
    readonly_fields = ('id', 'user', 'content_type', 'object_id', 'created_at')

@admin.register(DiscountCode)
class DiscountCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'percent', 'is_active', 'expiry_date')
    search_fields = ('code',)
    list_filter = ('is_active',)
