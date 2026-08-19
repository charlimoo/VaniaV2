from django.core.cache import cache
from django.db import migrations


NEW_SUPPORT_DETAILS = {
    "support_phone": "02193110033",
    "support_email": "support@vaniaapp.app",
    "support_contacts": [
        {
            "role": "مدیر ای تی و پاسخگویی",
            "name": "سیاوش یکتا",
            "phone": "02193110033 داخلی ۲۰۱",
        },
        {
            "role": "مدیر فنی و مدیر عامل",
            "name": "جلال مرادی",
            "phone": "02193110033 داخلی ۲۱۰",
        },
        {
            "role": "مدیر حقوقی و امور قراردادها",
            "name": "فریما شمسا",
            "phone": "02193110033 داخلی ۲۰۸",
        },
        {
            "role": "ارتباط تکمیلی",
            "name": "محمد گودرزی",
            "phone": "02193110033 داخلی ۲۰۹",
        },
    ],
}

OLD_SUPPORT_DETAILS = {
    "support_phone": "09371615614",
    "support_email": "support@vania.ir",
    "support_contacts": [
        {
            "role": "مدیر ای تی و پاسخگویی",
            "name": "سیاوش یکتا",
            "phone": "09371615614",
        },
        {
            "role": "مدیر فنی و مدیر عامل",
            "name": "جلال مرادی",
            "phone": "09128175882",
        },
        {
            "role": "مدیر حقوقی و امور قراردادها",
            "name": "فریما شمسا",
            "phone": "09128930862",
        },
        {
            "role": "ارتباط تکمیلی",
            "name": "محمد گودرزی",
            "phone": "+989123097970",
        },
    ],
}


def update_support_details(apps, schema_editor):
    BillingConfig = apps.get_model("billing", "BillingConfig")
    BillingConfig.objects.filter(pk=1).update(**NEW_SUPPORT_DETAILS)
    cache.delete("billing_config")


def restore_support_details(apps, schema_editor):
    BillingConfig = apps.get_model("billing", "BillingConfig")
    BillingConfig.objects.filter(pk=1).update(**OLD_SUPPORT_DETAILS)
    cache.delete("billing_config")


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0012_alter_subscriptionplan_duration_days_and_more"),
    ]

    operations = [
        migrations.RunPython(update_support_details, restore_support_details),
    ]
