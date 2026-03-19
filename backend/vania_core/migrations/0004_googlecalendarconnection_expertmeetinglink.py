from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("vania_core", "0003_location_doctorprofile_location"),
    ]

    operations = [
        migrations.CreateModel(
            name="GoogleCalendarConnection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("client_id", models.CharField(blank=True, max_length=255)),
                ("client_secret", models.CharField(blank=True, max_length=255)),
                ("calendar_id", models.CharField(blank=True, help_text="Leave blank to use the primary calendar for the connected Google account.", max_length=255)),
                ("token_json", models.JSONField(blank=True, default=dict)),
                ("is_connected", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Google Calendar Connection",
                "verbose_name_plural": "Google Calendar Connection",
            },
        ),
        migrations.CreateModel(
            name="ExpertMeetingLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("google_event_id", models.CharField(max_length=255)),
                ("meet_link", models.URLField()),
                ("attendee_emails", models.JSONField(blank=True, default=list)),
                ("started_at", models.DateTimeField()),
                ("ends_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("creator", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="created_meeting_links", to=settings.AUTH_USER_MODEL)),
                ("visitor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="received_meeting_links", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="expertmeetinglink",
            index=models.Index(fields=["creator", "-created_at"], name="vania_core__creator_8fafef_idx"),
        ),
        migrations.AddIndex(
            model_name="expertmeetinglink",
            index=models.Index(fields=["visitor", "-created_at"], name="vania_core__visitor_27217e_idx"),
        ),
    ]
