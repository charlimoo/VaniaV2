from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("vania_core", "0014_esanj_access_defaults"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="esanjtestaccessrule",
            new_name="vania_core__is_acti_eb100c_idx",
            old_name="vania_core_is_acti_e2e475_idx",
        ),
        migrations.RenameIndex(
            model_name="esanjtestaccessrule",
            new_name="vania_core__is_acti_2aa26f_idx",
            old_name="vania_core_is_acti_0a916d_idx",
        ),
        migrations.RenameIndex(
            model_name="esanjtestattempt",
            new_name="vania_core__user_id_906e8b_idx",
            old_name="vania_core_user_id_2f248d_idx",
        ),
        migrations.RenameIndex(
            model_name="esanjtestattempt",
            new_name="vania_core__user_id_f5482b_idx",
            old_name="vania_core_user_id_70dd72_idx",
        ),
        migrations.RenameIndex(
            model_name="esanjtestattempt",
            new_name="vania_core__user_id_976d53_idx",
            old_name="vania_core_user_id_b59a2d_idx",
        ),
        migrations.RenameIndex(
            model_name="esanjtestattempt",
            new_name="vania_core__esanj_t_5d30f7_idx",
            old_name="vania_core_esanj_t_17f6b7_idx",
        ),
    ]
