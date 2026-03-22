from django.db import models


class Company(models.Model):
    cik = models.CharField(max_length=20, unique=True, help_text="SEC CIK identifier")
    ticker = models.CharField(max_length=10, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    sector = models.CharField(max_length=100, blank=True, default='')
    industry = models.CharField(max_length=200, blank=True, default='')
    description = models.TextField(blank=True, default='')

    # Cached price data from yfinance
    current_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    market_cap = models.BigIntegerField(null=True, blank=True)
    week_52_high = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    week_52_low = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    shares_outstanding = models.BigIntegerField(null=True, blank=True)
    price_updated_at = models.DateTimeField(null=True, blank=True)

    # Raw SEC data for AI context
    raw_facts_json = models.JSONField(null=True, blank=True, help_text="Full SEC XBRL response")
    facts_updated_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "companies"
        ordering = ['ticker']

    def __str__(self):
        return f"{self.ticker} — {self.name}"


class FinancialFact(models.Model):
    PERIOD_CHOICES = [
        ('annual', 'Annual'),
        ('quarterly', 'Quarterly'),
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='financials')
    metric = models.CharField(max_length=50, db_index=True)
    period_type = models.CharField(max_length=10, choices=PERIOD_CHOICES)
    fiscal_year = models.IntegerField()
    fiscal_quarter = models.IntegerField(null=True, blank=True)
    period_end_date = models.DateField(null=True, blank=True)
    value = models.DecimalField(max_digits=20, decimal_places=2)
    unit = models.CharField(max_length=20, default='USD')
    form_type = models.CharField(max_length=10, blank=True, default='')
    filed_date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ['company', 'metric', 'period_type', 'fiscal_year', 'fiscal_quarter']
        indexes = [
            models.Index(fields=['company', 'metric', 'period_type']),
            models.Index(fields=['metric', 'fiscal_year']),
        ]
        ordering = ['-fiscal_year', '-fiscal_quarter']

    def __str__(self):
        q = f"Q{self.fiscal_quarter}" if self.fiscal_quarter else "FY"
        return f"{self.company.ticker} {self.metric} {self.fiscal_year} {q}: {self.value}"


class StockMetrics(models.Model):
    company = models.OneToOneField(Company, on_delete=models.CASCADE, related_name='metrics')
    pe_ratio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    dividend_yield = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    revenue_growth_yoy = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    profit_margin = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    gross_margin = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    operating_margin = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    roe = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    debt_to_equity = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    free_cash_flow = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "stock metrics"

    def __str__(self):
        return f"{self.company.ticker} metrics"


class IngestionLog(models.Model):
    STATUS_CHOICES = [
        ('in_progress', 'In Progress'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]
    SOURCE_CHOICES = [
        ('sec_edgar', 'SEC EDGAR'),
        ('yfinance', 'yfinance'),
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='ingestion_logs')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')
    error_message = models.TextField(blank=True, default='')
    records_created = models.IntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.company.ticker} {self.source} {self.status} {self.started_at:%Y-%m-%d %H:%M}"
