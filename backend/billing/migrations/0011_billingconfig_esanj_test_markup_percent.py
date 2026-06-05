from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0010_invoice_tax_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="billingconfig",
            name="esanj_test_markup_percent",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("10.00"),
                help_text="Markup percentage added to upstream interactive test base prices.",
                max_digits=5,
            ),
        ),
    ]
