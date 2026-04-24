from django.urls import path
from .views import (
    BillingConfigView,
    ProductListView,
    TransactionHistoryView,
    PurchaseDirectView,
    InvoiceDetailView,
    InitiatePaymentView,
    PaymentCallbackView,
    ZibalCallbackView,
    ApplyDiscountView,
    SubmitManualPaymentView,
    FAQListView 
)

urlpatterns = [
    # --- Configuration ---
    path('config/', BillingConfigView.as_view(), name='billing-config'),
    path('faqs/', FAQListView.as_view(), name='faq-list'),
    
    # --- Storefront ---
    path('products/', ProductListView.as_view(), name='product-list'),
    path('history/', TransactionHistoryView.as_view(), name='transaction-history'),
    
    # --- Purchase Flow ---
    path('purchase/', PurchaseDirectView.as_view(), name='purchase-direct'),
    path('invoices/<uuid:id>/', InvoiceDetailView.as_view(), name='invoice-detail'),
    
    # --- Payment Gateway ---
    path('invoices/<uuid:invoice_id>/apply_discount/', ApplyDiscountView.as_view(), name='apply-discount'),
    path('pay/<uuid:invoice_id>/', InitiatePaymentView.as_view(), name='initiate-payment'),
    path('callback/', PaymentCallbackView.as_view(), name='payment-callback'),
    path('zibal/callback/', ZibalCallbackView.as_view(), name='zibal-callback'),
    
    path('pay/manual/<uuid:invoice_id>/', SubmitManualPaymentView.as_view(), name='submit-manual-payment'),
]
