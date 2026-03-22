from django.contrib import admin
from .models import Company, FinancialFact, StockMetrics, IngestionLog


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['ticker', 'name', 'sector', 'current_price', 'market_cap', 'price_updated_at']
    list_filter = ['sector']
    search_fields = ['ticker', 'name', 'cik']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(FinancialFact)
class FinancialFactAdmin(admin.ModelAdmin):
    list_display = ['company', 'metric', 'period_type', 'fiscal_year', 'fiscal_quarter', 'value']
    list_filter = ['metric', 'period_type', 'fiscal_year']
    search_fields = ['company__ticker', 'company__name']
    raw_id_fields = ['company']


@admin.register(StockMetrics)
class StockMetricsAdmin(admin.ModelAdmin):
    list_display = ['company', 'pe_ratio', 'profit_margin', 'roe', 'debt_to_equity', 'computed_at']
    search_fields = ['company__ticker', 'company__name']
    raw_id_fields = ['company']


@admin.register(IngestionLog)
class IngestionLogAdmin(admin.ModelAdmin):
    list_display = ['company', 'source', 'status', 'records_created', 'started_at', 'completed_at']
    list_filter = ['source', 'status']
    search_fields = ['company__ticker']
    raw_id_fields = ['company']
