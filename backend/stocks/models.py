from django.conf import settings
from django.db import models


class Company(models.Model):
    cik = models.CharField(max_length=20, unique=True, help_text="SEC CIK identifier")
    ticker = models.CharField(max_length=10, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    exchange = models.CharField(max_length=50, blank=True, default="")
    sector = models.CharField(max_length=100, blank=True, default="")
    industry = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(blank=True, default="")
    website = models.URLField(blank=True, default="")
    current_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    market_cap = models.BigIntegerField(null=True, blank=True)
    week_52_high = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    week_52_low = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    shares_outstanding = models.BigIntegerField(null=True, blank=True)
    quote_updated_at = models.DateTimeField(null=True, blank=True)
    facts_updated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["ticker"]
        verbose_name_plural = "companies"

    def __str__(self):
        return f"{self.ticker} - {self.name}"


class FinancialFact(models.Model):
    PERIOD_ANNUAL = "annual"
    PERIOD_QUARTERLY = "quarterly"
    PERIOD_CHOICES = [
        (PERIOD_ANNUAL, "Annual"),
        (PERIOD_QUARTERLY, "Quarterly"),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="financial_facts",
    )
    metric_key = models.CharField(max_length=50, db_index=True)
    period_type = models.CharField(max_length=10, choices=PERIOD_CHOICES)
    fiscal_year = models.IntegerField()
    fiscal_quarter = models.IntegerField(null=True, blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    value = models.DecimalField(max_digits=24, decimal_places=6)
    unit = models.CharField(max_length=32, default="USD")
    source_tag = models.CharField(max_length=120, blank=True, default="")
    source_form = models.CharField(max_length=20, blank=True, default="")
    filed_date = models.DateField(null=True, blank=True)
    is_amended = models.BooleanField(default=False)
    is_derived = models.BooleanField(default=False)
    selection_reason = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        ordering = ["-fiscal_year", "-fiscal_quarter", "-period_end"]
        indexes = [
            models.Index(
                fields=["company", "metric_key", "period_type"],
                name="stocks_fact_cmp_metric_idx",
            ),
            models.Index(
                fields=["metric_key", "fiscal_year"],
                name="stocks_fact_metric_year_idx",
            ),
            models.Index(
                fields=["company", "period_type", "period_end"],
                name="stocks_fact_cmp_period_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "metric_key", "period_type", "fiscal_year", "period_end"],
                name="stocks_fact_company_metric_period",
            ),
        ]

    def __str__(self):
        return f"{self.company.ticker} {self.metric_key} {self.period_type} {self.fiscal_year}"


class MetricSnapshot(models.Model):
    company = models.OneToOneField(
        Company,
        on_delete=models.CASCADE,
        related_name="metrics",
    )
    pe_ratio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    dividend_yield = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    revenue_growth_yoy = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    gross_margin = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    operating_margin = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    net_margin = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    roe = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    debt_to_equity = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    free_cash_flow = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "metric snapshots"

    def __str__(self):
        return f"{self.company.ticker} snapshot"


class PriceCache(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="price_caches",
    )
    range_key = models.CharField(max_length=12)
    sampling_granularity = models.CharField(max_length=20, default="daily")
    data_json = models.JSONField(default=list, blank=True)
    is_stale = models.BooleanField(default=False)
    source_updated_at = models.DateTimeField(null=True, blank=True)
    cached_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["company_id", "range_key"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "range_key"],
                name="stocks_pricecache_company_range",
            ),
        ]

    def __str__(self):
        return f"{self.company.ticker} {self.range_key}"


class IngestionRun(models.Model):
    SOURCE_COMPANIES = "companies"
    SOURCE_SEC = "sec"
    SOURCE_PRICES = "prices"
    SOURCE_SNAPSHOTS = "snapshots"
    SOURCE_CHOICES = [
        (SOURCE_COMPANIES, "Companies"),
        (SOURCE_SEC, "SEC"),
        (SOURCE_PRICES, "Prices"),
        (SOURCE_SNAPSHOTS, "Snapshots"),
    ]

    STATUS_IN_PROGRESS = "in_progress"
    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_SUCCESS, "Success"),
        (STATUS_FAILED, "Failed"),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        related_name="ingestion_runs",
        null=True,
        blank=True,
    )
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS)
    details_json = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        company_label = self.company.ticker if self.company else "global"
        return f"{self.source} {company_label} {self.status}"


class RawSecPayload(models.Model):
    SOURCE_COMPANYFACTS = "companyfacts"
    SOURCE_SUBMISSIONS = "submissions"
    SOURCE_CHOICES = [
        (SOURCE_COMPANYFACTS, "Company Facts"),
        (SOURCE_SUBMISSIONS, "Submissions"),
    ]

    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_SUCCESS, "Success"),
        (STATUS_FAILED, "Failed"),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="raw_sec_payloads",
    )
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    payload_json = models.JSONField(default=dict, blank=True)
    fetched_at = models.DateTimeField(auto_now_add=True)
    retention_note = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-fetched_at"]

    def __str__(self):
        return f"{self.company.ticker} {self.source} {self.status}"


class AIUsageCounter(models.Model):
    usage_key_hash = models.CharField(max_length=128, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_usage_counters",
    )
    day = models.DateField(db_index=True)
    request_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-day", "usage_key_hash"]
        constraints = [
            models.UniqueConstraint(
                fields=["usage_key_hash", "day"],
                name="stocks_aiusage_key_day",
            ),
        ]
