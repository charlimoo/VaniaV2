from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0008_billingconfig_support_contacts_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="invoice",
            name="card_number",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
    ]
