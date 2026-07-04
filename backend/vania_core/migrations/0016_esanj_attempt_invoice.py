from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0012_alter_subscriptionplan_duration_days_and_more"),
        ("vania_core", "0015_rename_vania_core_is_acti_e2e475_idx_vania_core__is_acti_eb100c_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="esanjtestattempt",
            name="invoice",
            field=models.OneToOneField(
                blank=True,
                help_text="Paid invoice consumed by this interactive test attempt.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="esanj_test_attempt",
                to="billing.invoice",
            ),
        ),
        migrations.AddIndex(
            model_name="esanjtestattempt",
            index=models.Index(fields=["user", "invoice"], name="vania_core__user_id_035a46_idx"),
        ),
    ]
