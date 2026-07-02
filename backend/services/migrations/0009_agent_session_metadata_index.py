from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("services", "0008_agentservice_audience_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            DO $$
            BEGIN
                IF to_regclass('ai.agent_sessions') IS NOT NULL THEN
                    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_type_created_at ON ai.agent_sessions (user_id, session_type, created_at DESC)';
                ELSIF to_regclass('agent_sessions') IS NOT NULL THEN
                    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_type_created_at ON agent_sessions (user_id, session_type, created_at DESC)';
                END IF;
            END $$;
            """,
            reverse_sql="""
            DO $$
            BEGIN
                IF to_regclass('ai.idx_agent_sessions_user_type_created_at') IS NOT NULL THEN
                    EXECUTE 'DROP INDEX ai.idx_agent_sessions_user_type_created_at';
                END IF;
                IF to_regclass('public.idx_agent_sessions_user_type_created_at') IS NOT NULL THEN
                    EXECUTE 'DROP INDEX public.idx_agent_sessions_user_type_created_at';
                END IF;
            END $$;
            """,
        ),
    ]
