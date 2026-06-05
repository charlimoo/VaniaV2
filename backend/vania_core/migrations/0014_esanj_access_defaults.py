from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("vania_core", "0013_esanj_attempt_assignment"),
    ]

    operations = [
        migrations.AlterField(
            model_name="esanjtestaccessrule",
            name="allow_experts",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="esanjtestaccessrule",
            name="is_active",
            field=models.BooleanField(default=True, help_text="Visible to eligible users when enabled."),
        ),
    ]
