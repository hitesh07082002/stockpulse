from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("stocks", "0003_delete_aibudgetday"),
    ]

    operations = [
        migrations.AlterField(
            model_name="ingestionrun",
            name="source",
            field=models.CharField(
                choices=[
                    ("companies", "Companies"),
                    ("sec", "SEC"),
                    ("prices", "Prices"),
                    ("snapshots", "Snapshots"),
                    ("metadata", "Metadata"),
                ],
                max_length=20,
            ),
        ),
    ]
