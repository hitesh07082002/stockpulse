from django.contrib import admin

from .models import AIUsageCounter, Company, FinancialFact, IngestionRun, MetricSnapshot, PriceCache, RawSecPayload


admin.site.site_header = "StockPulse Admin"
admin.site.site_title = "StockPulse Admin"
admin.site.index_title = "Operations"


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["ticker", "name", "exchange", "sector", "current_price", "market_cap", "quote_updated_at"]
    list_filter = ["exchange", "sector"]
    search_fields = ["ticker", "name", "cik"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(FinancialFact)
class FinancialFactAdmin(admin.ModelAdmin):
    list_display = ["company", "metric_key", "period_type", "fiscal_year", "fiscal_quarter", "value"]
    list_filter = ["metric_key", "period_type", "fiscal_year"]
    search_fields = ["company__ticker", "company__name"]
    list_select_related = ["company"]
    raw_id_fields = ["company"]


@admin.register(MetricSnapshot)
class MetricSnapshotAdmin(admin.ModelAdmin):
    list_display = ["company", "pe_ratio", "net_margin", "roe", "debt_to_equity", "computed_at"]
    search_fields = ["company__ticker", "company__name"]
    list_select_related = ["company"]
    raw_id_fields = ["company"]


@admin.register(IngestionRun)
class IngestionRunAdmin(admin.ModelAdmin):
    list_display = ["company", "source", "status", "started_at", "completed_at"]
    list_filter = ["source", "status"]
    search_fields = ["company__ticker", "company__name"]
    list_select_related = ["company"]
    raw_id_fields = ["company"]


@admin.register(PriceCache)
class PriceCacheAdmin(admin.ModelAdmin):
    list_display = ["company", "range_key", "sampling_granularity", "is_stale", "source_updated_at", "cached_at"]
    list_filter = ["range_key", "sampling_granularity", "is_stale"]
    search_fields = ["company__ticker"]
    list_select_related = ["company"]
    raw_id_fields = ["company"]


@admin.register(RawSecPayload)
class RawSecPayloadAdmin(admin.ModelAdmin):
    list_display = ["company", "source", "status", "fetched_at"]
    list_filter = ["source", "status"]
    search_fields = ["company__ticker"]
    list_select_related = ["company"]
    raw_id_fields = ["company"]


@admin.register(AIUsageCounter)
class AIUsageCounterAdmin(admin.ModelAdmin):
    list_display = ["usage_key_hash", "user", "day", "request_count", "updated_at"]
    list_filter = ["day"]
    search_fields = ["usage_key_hash", "user__email", "user__username"]
    list_select_related = ["user"]
    raw_id_fields = ["user"]
