from .models import MetricSnapshot


SCREENER_RANGE_FILTERS = {
    "pe_min": ("pe_ratio__gte", float),
    "pe_max": ("pe_ratio__lte", float),
    "market_cap_min": ("company__market_cap__gte", int),
    "market_cap_max": ("company__market_cap__lte", int),
    "revenue_growth_min": ("revenue_growth_yoy__gte", float),
    "revenue_growth_max": ("revenue_growth_yoy__lte", float),
    "gross_margin_min": ("gross_margin__gte", float),
    "gross_margin_max": ("gross_margin__lte", float),
    "operating_margin_min": ("operating_margin__gte", float),
    "operating_margin_max": ("operating_margin__lte", float),
    "debt_to_equity_min": ("debt_to_equity__gte", float),
    "debt_to_equity_max": ("debt_to_equity__lte", float),
}

SCREENER_ALLOWED_SORTS = {
    "market_cap": "company__market_cap",
    "current_price": "company__current_price",
    "pe_ratio": "pe_ratio",
    "industry": "company__industry",
    "revenue_growth_yoy": "revenue_growth_yoy",
    "gross_margin": "gross_margin",
    "operating_margin": "operating_margin",
    "debt_to_equity": "debt_to_equity",
    "free_cash_flow": "free_cash_flow",
    "ticker": "company__ticker",
    "name": "company__name",
    "sector": "company__sector",
}

TRUTHY_QUERY_VALUES = {"1", "true", "yes", "on"}


def build_screener_queryset(params):
    queryset = MetricSnapshot.objects.select_related("company").all()

    sector = params.get("sector")
    if sector:
        queryset = queryset.filter(company__sector__iexact=sector)

    industry = params.get("industry")
    if industry:
        queryset = queryset.filter(company__industry__icontains=industry)

    for param_name, (field_lookup, cast_fn) in SCREENER_RANGE_FILTERS.items():
        raw_value = params.get(param_name)
        if raw_value is None:
            continue

        try:
            queryset = queryset.filter(**{field_lookup: cast_fn(raw_value)})
        except (TypeError, ValueError):
            continue

    positive_fcf = params.get("positive_fcf", params.get("positive_free_cash_flow"))
    if str(positive_fcf).lower() in TRUTHY_QUERY_VALUES:
        queryset = queryset.filter(free_cash_flow__gt=0)

    sort_field = params.get("sort", "market_cap")
    order = params.get("order", "desc")
    db_field = SCREENER_ALLOWED_SORTS.get(sort_field, SCREENER_ALLOWED_SORTS["market_cap"])

    if order == "asc":
        return queryset.order_by(db_field)
    return queryset.order_by(f"-{db_field}")
