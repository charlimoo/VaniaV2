from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("vania_core", "0012_esanj_tests"),
    ]

    operations = [
        migrations.AddField(
            model_name="esanjtestattempt",
            name="assigned_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_esanj_test_attempts", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="esanjtestattempt",
            name="case_id",
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddField(
            model_name="esanjtestattempt",
            name="clinical_test_id",
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddField(
            model_name="esanjtestattempt",
            name="doctor_id",
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.AddIndex(
            model_name="esanjtestattempt",
            index=models.Index(fields=["user", "clinical_test_id"], name="vania_core_user_id_b59a2d_idx"),
        ),
    ]
