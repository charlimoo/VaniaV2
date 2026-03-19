from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("vania_core", "0005_rename_vania_core__creator_8fafef_idx_vania_core__creator_28a3d4_idx_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CaseAccessGrant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("case_id", models.CharField(db_index=True, max_length=64)),
                ("access_mode", models.CharField(choices=[("READ_ONLY", "Read only")], default="READ_ONLY", max_length=20)),
                ("status", models.CharField(choices=[("ACTIVE", "Active"), ("REVOKED", "Revoked")], default="ACTIVE", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("granted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="granted_case_access_entries", to=settings.AUTH_USER_MODEL)),
                ("grantee_doctor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="received_case_access_grants", to=settings.AUTH_USER_MODEL)),
                ("owner_doctor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="owned_case_access_grants", to=settings.AUTH_USER_MODEL)),
                ("patient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="case_access_grants", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-updated_at", "-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="caseaccessgrant",
            constraint=models.UniqueConstraint(fields=("patient", "case_id", "grantee_doctor"), name="vania_case_access_unique_grantee_per_case"),
        ),
        migrations.AddIndex(
            model_name="caseaccessgrant",
            index=models.Index(fields=["patient", "case_id", "status"], name="vania_core__patient_55fcf0_idx"),
        ),
        migrations.AddIndex(
            model_name="caseaccessgrant",
            index=models.Index(fields=["grantee_doctor", "status"], name="vania_core__grantee_e8f9e3_idx"),
        ),
        migrations.AddIndex(
            model_name="caseaccessgrant",
            index=models.Index(fields=["owner_doctor", "status"], name="vania_core__owner_d8d026_idx"),
        ),
    ]
