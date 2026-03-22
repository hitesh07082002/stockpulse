from django.contrib import admin

from .models import Company, FinancialFact, IngestionRun, MetricSnapshot, PriceCache, RawSecPayload


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["ticker", "name", "exchange", "sector", "current_price", "market_cap", "quote_updated_at"]
    list_filter = ["sector"]
    search_fields = ["ticker", "name", "cik"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(FinancialFact)
class FinancialFactAdmin(admin.ModelAdmin):
    list_display = ["company", "metric_key", "period_type", "fiscal_year", "fiscal_quarter", "value"]
    list_filter = ["metric_key", "period_type", "fiscal_year"]
    search_fields = ["company__ticker", "company__name"]
    raw_id_fields = ["company"]


@admin.register(MetricSnapshot)
class MetricSnapshotAdmin(admin.ModelAdmin):
    list_display = ["company", "pe_ratio", "net_margin", "roe", "debt_to_equity", "computed_at"]
    search_fields = ["company__ticker", "company__name"]
    raw_id_fields = ["company"]


@admin.register(IngestionRun)
class IngestionRunAdmin(admin.ModelAdmin):
    list_display = ["company", "source", "status", "started_at", "completed_at"]
    list_filter = ["source", "status"]
    search_fields = ["company__ticker"]
    raw_id_fields = ["company"]


@admin.register(PriceCache)
class PriceCacheAdmin(admin.ModelAdmin):
    list_display = ["company", "range_key", "sampling_granularity", "is_stale", "cached_at"]
    list_filter = ["range_key", "sampling_granularity", "is_stale"]
    search_fields = ["company__ticker"]
    raw_id_fields = ["company"]


@admin.register(RawSecPayload)
class RawSecPayloadAdmin(admin.ModelAdmin):
    list_display = ["company", "source", "status", "fetched_at"]
    list_filter = ["source", "status"]
    search_fields = ["company__ticker"]
    raw_id_fields = ["company"]
