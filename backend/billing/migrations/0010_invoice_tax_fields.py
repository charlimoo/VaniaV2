from decimal import Decimal

from django.db import migrations, models


def initialize_legacy_invoice_tax_fields(apps, schema_editor):
    Invoice = apps.get_model("billing", "Invoice")
    Invoice.objects.update(
        subtotal_amount=models.F("total_amount"),
        tax_rate=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
    )


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0009_invoice_card_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="invoice",
            name="subtotal_amount",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12),
        ),
        migrations.AddField(
            model_name="invoice",
            name="tax_rate",
            field=models.DecimalField(decimal_places=2, default=Decimal("10.00"), max_digits=5),
        ),
        migrations.AddField(
            model_name="invoice",
            name="tax_amount",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12),
        ),
        migrations.RunPython(initialize_legacy_invoice_tax_fields, migrations.RunPython.noop),
    ]
