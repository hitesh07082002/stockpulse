import json
from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from .metric_registry import list_metric_keys
from .models import FinancialFact, MetricSnapshot


AI_CONTEXT_METRICS = tuple(list_metric_keys())
SNAPSHOT_FIELDS = (
    "pe_ratio",
    "dividend_yield",
    "revenue_growth_yoy",
    "gross_margin",
    "operating_margin",
    "net_margin",
    "roe",
    "debt_to_equity",
    "free_cash_flow",
)


def build_structured_context(company):
    annual_facts = list(
        FinancialFact.objects.filter(
            company=company,
            period_type=FinancialFact.PERIOD_ANNUAL,
            metric_key__in=AI_CONTEXT_METRICS,
        )
        .order_by("-fiscal_year", "-period_end", "metric_key")[
            : settings.AI_CONTEXT_ANNUAL_PERIODS * len(AI_CONTEXT_METRICS)
        ]
    )
    quarterly_facts = list(
        FinancialFact.objects.filter(
            company=company,
            period_type=FinancialFact.PERIOD_QUARTERLY,
            metric_key__in=AI_CONTEXT_METRICS,
        )
        .order_by("-fiscal_year", "-fiscal_quarter", "-period_end", "metric_key")[
            : settings.AI_CONTEXT_QUARTERLY_PERIODS * len(AI_CONTEXT_METRICS)
        ]
    )

    annual_series = _build_period_series(
        annual_facts,
        limit=settings.AI_CONTEXT_ANNUAL_PERIODS,
        quarterly=False,
    )
    quarterly_series = _build_period_series(
        quarterly_facts,
        limit=settings.AI_CONTEXT_QUARTERLY_PERIODS,
        quarterly=True,
    )
    snapshot = _serialize_snapshot(company)
    coverage = _build_coverage(annual_series, quarterly_series, snapshot)

    return _drop_none(
        {
            "identity": {
                "ticker": company.ticker,
                "name": company.name,
                "sector": company.sector or None,
                "industry": company.industry or None,
                "exchange": company.exchange or None,
                "description": company.description or None,
                "website": company.website or None,
                "current_price": _to_number(company.current_price),
                "market_cap": company.market_cap,
                "shares_outstanding": company.shares_outstanding,
            },
            "freshness": {
                "quote_updated_at": _iso_datetime(company.quote_updated_at),
                "facts_updated_at": _iso_datetime(company.facts_updated_at),
                "quote_age_hours": _age_hours(company.quote_updated_at),
                "facts_age_hours": _age_hours(company.facts_updated_at),
                "has_quote": company.current_price is not None,
            },
            "snapshot": snapshot,
            "annual_series": annual_series,
            "quarterly_series": quarterly_series,
            "coverage": coverage,
        }
    )


def build_stream_meta(company, context, remaining_daily_quota=None):
    freshness = context.get("freshness", {})
    coverage = context.get("coverage", {})
    quote_age_hours = freshness.get("quote_age_hours")
    quote_freshness = (
        f"Quote updated {quote_age_hours}h ago"
        if quote_age_hours is not None
        else "Quote freshness unavailable"
    )
    return {
        "ticker": company.ticker,
        "company_name": company.name,
        "quote_updated_at": freshness.get("quote_updated_at"),
        "facts_updated_at": freshness.get("facts_updated_at"),
        "quote_freshness": quote_freshness,
        "coverage_summary": coverage.get("summary"),
        "remaining_quota": remaining_daily_quota,
        "coverage": {
            "is_sparse": coverage.get("is_sparse"),
            "summary": coverage.get("summary"),
            "notes": coverage.get("notes"),
            "annual_period_count": coverage.get("annual_period_count"),
            "quarterly_period_count": coverage.get("quarterly_period_count"),
        },
    }


def render_system_prompt(context):
    identity = context["identity"]
    company_name = identity["name"]
    ticker = identity["ticker"]
    sector = identity.get("sector") or "sector unavailable"
    payload = json.dumps(context, separators=(",", ":"), sort_keys=True)
    return (
        "You are StockPulse Copilot, a sharp equity research analyst. Be concise, quantitative, and useful.\n"
        f"You are helping the user analyze {company_name} ({ticker}, {sector}). Below is StockPulse's structured financial data for this company.\n"
        "Answer the user's question using your full knowledge, including industry trends, macro context, competitive dynamics, and general finance principles.\n"
        "Use the StockPulse data below to ground the analysis with real numbers when relevant.\n"
        "Treat every annual_series and quarterly_series value in StockPulse as reported historical company data, not a forecast or projection.\n"
        "If you discuss future expectations, label them clearly as general analysis or scenario thinking rather than reported StockPulse data.\n"
        "Focus on trend detection, period comparisons, ratio interpretation, and what the numbers imply.\n"
        "Use markdown with short headers, **bold** key numbers, and tables when comparisons are clearer in tabular form.\n"
        "Typical answers should be 200-400 words unless the user asks for a different length.\n"
        "Lead with the direct answer first, then the 3-5 most material supporting points.\n"
        "Avoid padding or repetition. If a topic needs more depth, finish the concise answer and leave room for follow-up.\n"
        "Never predict future stock prices or guarantee outcomes.\n"
        "Be friendly and human sounding in your responses.\n"
        "If StockPulse data is sparse or missing, say so clearly and still provide the best general explanation you can.\n"
        "Be explicit about which claims come from StockPulse data and which come from general financial knowledge.\n\n"
        "STRUCTURED_CONTEXT_JSON:\n"
        f"{payload}"
    )


def _serialize_snapshot(company):
    try:
        snapshot = company.metrics
    except MetricSnapshot.DoesNotExist:
        snapshot = None

    if snapshot is None:
        return {field: None for field in SNAPSHOT_FIELDS}

    return {
        field: _to_number(getattr(snapshot, field))
        for field in SNAPSHOT_FIELDS
    }


def _build_period_series(facts, *, limit, quarterly):
    grouped = {}
    ordered_keys = []

    for fact in facts:
        key = _period_key(fact, quarterly=quarterly)
        if key not in grouped:
            grouped[key] = _empty_period_row(fact, quarterly=quarterly)
            ordered_keys.append(key)
        grouped[key]["metrics"][fact.metric_key] = _to_number(fact.value)

    selected_rows = [grouped[key] for key in ordered_keys[:limit]]
    selected_rows.reverse()
    return selected_rows


def _empty_period_row(fact, *, quarterly):
    metrics = {metric: None for metric in AI_CONTEXT_METRICS}
    label = (
        f"{fact.fiscal_year} Q{fact.fiscal_quarter}"
        if quarterly and fact.fiscal_quarter
        else str(fact.fiscal_year)
    )
    return {
        "label": label,
        "fiscal_year": fact.fiscal_year,
        "fiscal_quarter": fact.fiscal_quarter if quarterly else None,
        "period_end": _iso_date(fact.period_end),
        "metrics": metrics,
    }


def _period_key(fact, *, quarterly):
    return (
        fact.fiscal_year,
        fact.fiscal_quarter if quarterly else None,
        fact.period_end.isoformat() if fact.period_end else "",
    )


def _build_coverage(annual_series, quarterly_series, snapshot):
    annual_counts = _metric_counts(annual_series)
    quarterly_counts = _metric_counts(quarterly_series)
    missing_snapshot_fields = [
        field for field, value in snapshot.items() if value is None
    ]

    notes = []
    if len(annual_series) < 3:
        notes.append("Annual history is sparse.")
    if len(quarterly_series) < 4:
        notes.append("Quarterly history is sparse.")
    if missing_snapshot_fields:
        notes.append("Some snapshot metrics are unavailable.")

    missing_annual = [metric for metric, count in annual_counts.items() if count == 0]
    missing_quarterly = [metric for metric, count in quarterly_counts.items() if count == 0]
    if missing_annual:
        notes.append(f"Annual gaps: {', '.join(missing_annual[:5])}.")
    if missing_quarterly:
        notes.append(f"Quarterly gaps: {', '.join(missing_quarterly[:5])}.")

    return {
        "annual_period_count": len(annual_series),
        "quarterly_period_count": len(quarterly_series),
        "annual_metric_counts": annual_counts,
        "quarterly_metric_counts": quarterly_counts,
        "missing_snapshot_fields": missing_snapshot_fields,
        "is_sparse": bool(notes),
        "notes": notes,
        "summary": _coverage_summary(len(annual_series), len(quarterly_series), notes),
    }


def _metric_counts(series):
    counts = defaultdict(int)
    for row in series:
        for metric, value in row["metrics"].items():
            if value is not None:
                counts[metric] += 1
            else:
                counts.setdefault(metric, 0)
    for metric in AI_CONTEXT_METRICS:
        counts.setdefault(metric, 0)
    return dict(counts)


def _coverage_summary(annual_count, quarterly_count, notes):
    summary = f"{annual_count} annual periods and {quarterly_count} quarterly periods available."
    if notes:
        return f"{summary} Coverage is partial."
    return summary


def _age_hours(value):
    if not value:
        return None
    delta = timezone.now() - value
    return round(delta.total_seconds() / 3600, 1)


def _iso_datetime(value):
    if not value:
        return None
    return value.isoformat()


def _iso_date(value):
    if not isinstance(value, date):
        return None
    return value.isoformat()


def _to_number(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return value


def _drop_none(value):
    if isinstance(value, dict):
        return {
            key: cleaned
            for key, nested in value.items()
            if (cleaned := _drop_none(nested)) is not None
        }
    if isinstance(value, list):
        return [_drop_none(item) for item in value]
    return value
