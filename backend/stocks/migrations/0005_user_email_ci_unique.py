from django.db import migrations


INDEX_NAME = "auth_user_email_ci_unique"


def create_case_insensitive_email_index(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT lower(email) AS normalized_email, COUNT(*)
            FROM auth_user
            WHERE email <> ''
            GROUP BY lower(email)
            HAVING COUNT(*) > 1
            ORDER BY normalized_email ASC
            """
        )
        duplicates = cursor.fetchall()
        if duplicates:
            summary = ", ".join(
                f"{normalized_email} ({count})"
                for normalized_email, count in duplicates[:5]
            )
            raise RuntimeError(
                "Cannot enforce case-insensitive unique auth_user emails until duplicates "
                f"are resolved: {summary}"
            )

        cursor.execute(
            f"CREATE UNIQUE INDEX {INDEX_NAME} ON auth_user (LOWER(email)) WHERE email <> ''"
        )


def drop_case_insensitive_email_index(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(f"DROP INDEX IF EXISTS {INDEX_NAME}")


class Migration(migrations.Migration):

    dependencies = [
        ("stocks", "0004_ingestionrun_metadata_source"),
    ]

    operations = [
        migrations.RunPython(
            create_case_insensitive_email_index,
            drop_case_insensitive_email_index,
        ),
    ]
