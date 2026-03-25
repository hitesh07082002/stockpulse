from django.db import migrations


INDEX_NAME = "auth_user_email_ci_unique"
ACCOUNT_EMAILADDRESS_TABLE = "account_emailaddress"
SOCIALACCOUNT_TABLE = "socialaccount_socialaccount"


def _table_names(schema_editor):
    return set(schema_editor.connection.introspection.table_names())


def _fetch_duplicate_emails(cursor):
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
    return cursor.fetchall()


def _as_row_dicts(cursor):
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def _candidate_query(has_emailaddress_table, has_socialaccount_table):
    email_verified_sql = (
        """
        EXISTS (
            SELECT 1
            FROM account_emailaddress ea
            WHERE ea.user_id = u.id
              AND lower(ea.email) = lower(u.email)
              AND ea.verified
        )
        """
        if has_emailaddress_table
        else "0"
    )
    email_primary_sql = (
        """
        EXISTS (
            SELECT 1
            FROM account_emailaddress ea
            WHERE ea.user_id = u.id
              AND lower(ea.email) = lower(u.email)
              AND ea."primary"
        )
        """
        if has_emailaddress_table
        else "0"
    )
    has_social_sql = (
        """
        EXISTS (
            SELECT 1
            FROM socialaccount_socialaccount sa
            WHERE sa.user_id = u.id
        )
        """
        if has_socialaccount_table
        else "0"
    )
    return f"""
        SELECT
            u.id,
            u.username,
            u.email,
            u.password,
            u.is_active,
            u.is_staff,
            u.is_superuser,
            u.last_login,
            u.date_joined,
            {email_verified_sql} AS email_verified,
            {email_primary_sql} AS email_primary,
            {has_social_sql} AS has_social
        FROM auth_user u
        WHERE lower(u.email) = %s
        ORDER BY u.id ASC
    """


def _datetime_sort_value(value):
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _has_usable_password(encoded_password):
    return bool(encoded_password) and not str(encoded_password).startswith("!")


def _candidate_sort_key(candidate):
    return (
        int(bool(candidate["is_superuser"])),
        int(bool(candidate["is_staff"])),
        int(bool(candidate["email_verified"])),
        int(bool(candidate["email_primary"])),
        int(bool(candidate["has_social"])),
        int(bool(candidate["is_active"])),
        int(_has_usable_password(candidate["password"])),
        _datetime_sort_value(candidate["last_login"]),
        _datetime_sort_value(candidate["date_joined"]),
        -int(candidate["id"]),
    )


def _select_canonical_user(candidates):
    ranked = sorted(candidates, key=_candidate_sort_key, reverse=True)
    return ranked[0]


def _disable_duplicate_users(cursor, normalized_email, canonical_user_id, has_emailaddress_table):
    cursor.execute(
        """
        SELECT id
        FROM auth_user
        WHERE lower(email) = %s AND id <> %s
        ORDER BY id ASC
        """,
        [normalized_email, canonical_user_id],
    )
    duplicate_ids = [row[0] for row in cursor.fetchall()]
    for duplicate_user_id in duplicate_ids:
        cursor.execute(
            """
            UPDATE auth_user
            SET email = '', is_active = %s
            WHERE id = %s
            """,
            [False, duplicate_user_id],
        )
        if has_emailaddress_table:
            cursor.execute(
                """
                DELETE FROM account_emailaddress
                WHERE user_id = %s AND lower(email) = %s
                """,
                [duplicate_user_id, normalized_email],
            )


def create_case_insensitive_email_index(apps, schema_editor):
    table_names = _table_names(schema_editor)
    has_emailaddress_table = ACCOUNT_EMAILADDRESS_TABLE in table_names
    has_socialaccount_table = SOCIALACCOUNT_TABLE in table_names

    with schema_editor.connection.cursor() as cursor:
        duplicates = _fetch_duplicate_emails(cursor)
        for normalized_email, _count in duplicates:
            cursor.execute(
                _candidate_query(has_emailaddress_table, has_socialaccount_table),
                [normalized_email],
            )
            candidates = _as_row_dicts(cursor)
            canonical_user = _select_canonical_user(candidates)
            _disable_duplicate_users(
                cursor,
                normalized_email,
                canonical_user["id"],
                has_emailaddress_table,
            )

        duplicates = _fetch_duplicate_emails(cursor)
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
            f"CREATE UNIQUE INDEX IF NOT EXISTS {INDEX_NAME} "
            "ON auth_user (LOWER(email)) WHERE email <> ''"
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
