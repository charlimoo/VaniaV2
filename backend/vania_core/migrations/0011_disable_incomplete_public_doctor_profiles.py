from django.db import migrations


def has_text(value):
    return bool(str(value or "").strip())


def has_sentence(value):
    text = " ".join(str(value or "").split())
    return len(text) >= 10 and len(text.split()) >= 2


def disable_incomplete_public_profiles(apps, schema_editor):
    DoctorProfile = apps.get_model("vania_core", "DoctorProfile")

    for profile in DoctorProfile.objects.filter(is_public=True).iterator():
        is_complete = (
            has_text(profile.specialty)
            and bool(profile.location_id)
            and has_text(profile.clinic_address)
            and has_sentence(profile.bio)
        )
        if not is_complete:
            profile.is_public = False
            profile.save(update_fields=["is_public"])


class Migration(migrations.Migration):
    dependencies = [
        ("vania_core", "0010_alter_pagetutorial_video"),
    ]

    operations = [
        migrations.RunPython(disable_incomplete_public_profiles, migrations.RunPython.noop),
    ]
