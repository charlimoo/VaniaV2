import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("users", "0007_customuser_national_code"),
        ("vania_core", "0011_disable_incomplete_public_doctor_profiles"),
    ]

    operations = [
        migrations.CreateModel(
            name="EsanjTestAccessRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("esanj_test_id", models.PositiveIntegerField(db_index=True, unique=True)),
                ("title", models.CharField(max_length=255)),
                ("title_employee", models.CharField(blank=True, max_length=255)),
                ("base_price", models.PositiveIntegerField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=False, help_text="Visible to eligible users when enabled.")),
                ("allow_visitors", models.BooleanField(default=True)),
                ("allow_experts", models.BooleanField(default=False)),
                ("notes", models.TextField(blank=True, help_text="Internal admin notes.")),
                ("upstream_payload", models.JSONField(blank=True, default=dict)),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "eligible_expert_professions",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Leave empty to allow every expert subtype when experts are enabled.",
                        related_name="esanj_test_rules",
                        to="users.expertprofession",
                    ),
                ),
            ],
            options={
                "verbose_name": "Esanj Test Access Rule",
                "verbose_name_plural": "Esanj Test Access Rules",
                "ordering": ["esanj_test_id"],
            },
        ),
        migrations.CreateModel(
            name="EsanjUserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("employee_id", models.PositiveIntegerField(blank=True, db_index=True, null=True)),
                ("employee_username", models.CharField(blank=True, db_index=True, max_length=100)),
                ("upstream_payload", models.JSONField(blank=True, default=dict)),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="esanj_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Esanj User Profile",
                "verbose_name_plural": "Esanj User Profiles",
            },
        ),
        migrations.CreateModel(
            name="EsanjTestAttempt",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("esanj_test_id", models.PositiveIntegerField(db_index=True)),
                ("test_title", models.CharField(max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("IN_PROGRESS", "In progress"),
                            ("SUBMITTED", "Submitted"),
                            ("COMPLETED", "Completed"),
                            ("FAILED", "Failed"),
                        ],
                        default="IN_PROGRESS",
                        max_length=20,
                    ),
                ),
                ("age", models.PositiveSmallIntegerField()),
                ("sex", models.CharField(choices=[("male", "Male"), ("female", "Female")], max_length=10)),
                ("employee_id", models.PositiveIntegerField(blank=True, null=True)),
                ("questionnaire", models.JSONField(blank=True, default=dict)),
                ("answers", models.JSONField(blank=True, default=dict)),
                ("result_json", models.JSONField(blank=True, default=dict)),
                ("grading_json", models.JSONField(blank=True, default=dict)),
                ("error_message", models.TextField(blank=True)),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "access_rule",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="attempts",
                        to="vania_core.esanjtestaccessrule",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="esanj_test_attempts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Esanj Test Attempt",
                "verbose_name_plural": "Esanj Test Attempts",
                "ordering": ["-started_at"],
            },
        ),
        migrations.AddIndex(
            model_name="esanjtestaccessrule",
            index=models.Index(fields=["is_active", "allow_visitors"], name="vania_core_is_acti_e2e475_idx"),
        ),
        migrations.AddIndex(
            model_name="esanjtestaccessrule",
            index=models.Index(fields=["is_active", "allow_experts"], name="vania_core_is_acti_0a916d_idx"),
        ),
        migrations.AddIndex(
            model_name="esanjtestattempt",
            index=models.Index(fields=["user", "-started_at"], name="vania_core_user_id_2f248d_idx"),
        ),
        migrations.AddIndex(
            model_name="esanjtestattempt",
            index=models.Index(fields=["user", "status"], name="vania_core_user_id_70dd72_idx"),
        ),
        migrations.AddIndex(
            model_name="esanjtestattempt",
            index=models.Index(fields=["esanj_test_id", "status"], name="vania_core_esanj_t_17f6b7_idx"),
        ),
    ]
