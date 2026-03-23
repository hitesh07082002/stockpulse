from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("stocks", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RenameField(
            model_name="company",
            old_name="price_updated_at",
            new_name="quote_updated_at",
        ),
        migrations.RemoveField(
            model_name="company",
            name="raw_facts_json",
        ),
        migrations.AddField(
            model_name="company",
            name="exchange",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="company",
            name="website",
            field=models.URLField(blank=True, default=""),
        ),
        migrations.RenameModel(
            old_name="IngestionLog",
            new_name="IngestionRun",
        ),
        migrations.RenameModel(
            old_name="StockMetrics",
            new_name="MetricSnapshot",
        ),
        migrations.RenameField(
            model_name="metricsnapshot",
            old_name="profit_margin",
            new_name="net_margin",
        ),
        migrations.RenameField(
            model_name="financialfact",
            old_name="metric",
            new_name="metric_key",
        ),
        migrations.RenameField(
            model_name="financialfact",
            old_name="period_end_date",
            new_name="period_end",
        ),
        migrations.RenameField(
            model_name="financialfact",
            old_name="form_type",
            new_name="source_form",
        ),
        migrations.AlterUniqueTogether(
            name="financialfact",
            unique_together=set(),
        ),
        migrations.RemoveIndex(
            model_name="financialfact",
            name="stocks_fina_company_308569_idx",
        ),
        migrations.RemoveIndex(
            model_name="financialfact",
            name="stocks_fina_metric_c0a2aa_idx",
        ),
        migrations.RemoveField(
            model_name="ingestionrun",
            name="error_message",
        ),
        migrations.RemoveField(
            model_name="ingestionrun",
            name="records_created",
        ),
        migrations.AddField(
            model_name="financialfact",
            name="is_amended",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="financialfact",
            name="is_derived",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="financialfact",
            name="period_start",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="financialfact",
            name="selection_reason",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="financialfact",
            name="source_tag",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="ingestionrun",
            name="details_json",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.CreateModel(
            name="AIBudgetDay",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("day", models.DateField(unique=True)),
                ("request_count", models.PositiveIntegerField(default=0)),
                ("reserved_cost_usd", models.DecimalField(decimal_places=4, default=Decimal("0.0000"), max_digits=12)),
                ("actual_cost_usd", models.DecimalField(decimal_places=4, default=Decimal("0.0000"), max_digits=12)),
                ("hard_stop_triggered_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-day"]},
        ),
        migrations.CreateModel(
            name="AIUsageCounter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("usage_key_hash", models.CharField(db_index=True, max_length=128)),
                ("day", models.DateField(db_index=True)),
                ("request_count", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ai_usage_counters",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-day", "usage_key_hash"]},
        ),
        migrations.CreateModel(
            name="PriceCache",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("range_key", models.CharField(max_length=12)),
                ("sampling_granularity", models.CharField(default="daily", max_length=20)),
                ("data_json", models.JSONField(blank=True, default=list)),
                ("is_stale", models.BooleanField(default=False)),
                ("source_updated_at", models.DateTimeField(blank=True, null=True)),
                ("cached_at", models.DateTimeField(auto_now=True)),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="price_caches",
                        to="stocks.company",
                    ),
                ),
            ],
            options={"ordering": ["company_id", "range_key"]},
        ),
        migrations.CreateModel(
            name="RawSecPayload",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source", models.CharField(choices=[("companyfacts", "Company Facts"), ("submissions", "Submissions")], max_length=20)),
                ("status", models.CharField(choices=[("success", "Success"), ("failed", "Failed")], max_length=20)),
                ("payload_json", models.JSONField(blank=True, default=dict)),
                ("fetched_at", models.DateTimeField(auto_now_add=True)),
                ("retention_note", models.CharField(blank=True, default="", max_length=255)),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="raw_sec_payloads",
                        to="stocks.company",
                    ),
                ),
            ],
            options={"ordering": ["-fetched_at"]},
        ),
        migrations.AlterModelOptions(
            name="financialfact",
            options={"ordering": ["-fiscal_year", "-fiscal_quarter", "-period_end"]},
        ),
        migrations.AlterModelOptions(
            name="metricsnapshot",
            options={"verbose_name_plural": "metric snapshots"},
        ),
        migrations.AlterField(
            model_name="financialfact",
            name="company",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="financial_facts", to="stocks.company"),
        ),
        migrations.AlterField(
            model_name="financialfact",
            name="metric_key",
            field=models.CharField(db_index=True, max_length=50),
        ),
        migrations.AlterField(
            model_name="financialfact",
            name="period_end",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="financialfact",
            name="source_form",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AlterField(
            model_name="financialfact",
            name="unit",
            field=models.CharField(default="USD", max_length=32),
        ),
        migrations.AlterField(
            model_name="financialfact",
            name="value",
            field=models.DecimalField(decimal_places=6, max_digits=24),
        ),
        migrations.AlterField(
            model_name="ingestionrun",
            name="company",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ingestion_runs", to="stocks.company"),
        ),
        migrations.AlterField(
            model_name="ingestionrun",
            name="source",
            field=models.CharField(choices=[("companies", "Companies"), ("sec", "SEC"), ("prices", "Prices"), ("snapshots", "Snapshots")], max_length=20),
        ),
        migrations.AlterField(
            model_name="ingestionrun",
            name="status",
            field=models.CharField(choices=[("in_progress", "In Progress"), ("success", "Success"), ("failed", "Failed")], default="in_progress", max_length=20),
        ),
        migrations.AlterField(
            model_name="metricsnapshot",
            name="company",
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="metrics", to="stocks.company"),
        ),
        migrations.AddIndex(
            model_name="financialfact",
            index=models.Index(fields=["company", "metric_key", "period_type"], name="stocks_fact_cmp_metric_idx"),
        ),
        migrations.AddIndex(
            model_name="financialfact",
            index=models.Index(fields=["metric_key", "fiscal_year"], name="stocks_fact_metric_year_idx"),
        ),
        migrations.AddIndex(
            model_name="financialfact",
            index=models.Index(fields=["company", "period_type", "period_end"], name="stocks_fact_cmp_period_idx"),
        ),
        migrations.AddConstraint(
            model_name="financialfact",
            constraint=models.UniqueConstraint(fields=("company", "metric_key", "period_type", "fiscal_year", "period_end"), name="stocks_fact_company_metric_period"),
        ),
        migrations.AddConstraint(
            model_name="aiusagecounter",
            constraint=models.UniqueConstraint(fields=("usage_key_hash", "day"), name="stocks_aiusage_key_day"),
        ),
        migrations.AddConstraint(
            model_name="pricecache",
            constraint=models.UniqueConstraint(fields=("company", "range_key"), name="stocks_pricecache_company_range"),
        ),
    ]
