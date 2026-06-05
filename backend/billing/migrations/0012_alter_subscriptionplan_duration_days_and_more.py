from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0011_billingconfig_esanj_test_markup_percent"),
    ]

    operations = [
        migrations.AlterField(
            model_name="subscriptionplan",
            name="duration_days",
            field=models.PositiveIntegerField(
                default=30,
                help_text="Legacy catalog field kept for compatibility; plan access no longer expires by time.",
            ),
        ),
        migrations.AlterField(
            model_name="userwallet",
            name="plan_expires_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Legacy field retained for compatibility. Plan ownership no longer expires by time.",
                null=True,
            ),
        ),
    ]
