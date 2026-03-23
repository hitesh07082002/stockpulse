from datetime import date, timedelta
from decimal import Decimal
import sys
import types

import pandas as pd
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from stocks import pricing as pricing_module
from stocks.models import Company, FinancialFact, MetricSnapshot, PriceCache


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def company():
    company = Company.objects.create(
        cik="0000789019",
        ticker="MSFT",
        name="Microsoft Corporation",
        sector="Technology",
        industry="Software",
        current_price=Decimal("415.67"),
        market_cap=3_100_000_000_000,
        shares_outstanding=7_430_000_000,
        quote_updated_at=timezone.now(),
        facts_updated_at=timezone.now(),
    )

    MetricSnapshot.objects.create(
        company=company,
        pe_ratio=Decimal("28.40"),
        dividend_yield=Decimal("0.0085"),
        revenue_growth_yoy=Decimal("0.1200"),
        operating_margin=Decimal("0.4400"),
        net_margin=Decimal("0.3600"),
        free_cash_flow=Decimal("100000000000"),
    )

    FinancialFact.objects.create(
        company=company,
        metric_key="revenue",
        period_type="annual",
        fiscal_year=2023,
        value=Decimal("211915000000"),
        period_end=date(2023, 6, 30),
        filed_date=date(2023, 8, 1),
        source_form="10-K",
    )
    FinancialFact.objects.create(
        company=company,
        metric_key="revenue",
        period_type="annual",
        fiscal_year=2024,
        value=Decimal("245122000000"),
        period_end=date(2024, 6, 30),
        filed_date=date(2024, 8, 1),
        source_form="10-K",
    )
    FinancialFact.objects.create(
        company=company,
        metric_key="diluted_eps",
        period_type="annual",
        fiscal_year=2023,
        value=Decimal("12.00"),
        period_end=date(2023, 6, 30),
        filed_date=date(2023, 8, 1),
        source_form="10-K",
    )
    FinancialFact.objects.create(
        company=company,
        metric_key="diluted_eps",
        period_type="annual",
        fiscal_year=2024,
        value=Decimal("14.64"),
        period_end=date(2024, 6, 30),
        filed_date=date(2024, 8, 1),
        source_form="10-K",
    )
    FinancialFact.objects.create(
        company=company,
        metric_key="free_cash_flow",
        period_type="annual",
        fiscal_year=2023,
        value=Decimal("90000000000"),
        period_end=date(2023, 6, 30),
        filed_date=date(2023, 8, 1),
        source_form="10-K",
    )
    FinancialFact.objects.create(
        company=company,
        metric_key="free_cash_flow",
        period_type="annual",
        fiscal_year=2024,
        value=Decimal("100000000000"),
        period_end=date(2024, 6, 30),
        filed_date=date(2024, 8, 1),
        source_form="10-K",
    )
    FinancialFact.objects.create(
        company=company,
        metric_key="operating_cash_flow",
        period_type="annual",
        fiscal_year=2024,
        value=Decimal("120000000000"),
        period_end=date(2024, 6, 30),
        filed_date=date(2024, 8, 1),
        source_form="10-K",
    )
    FinancialFact.objects.create(
        company=company,
        metric_key="capital_expenditures",
        period_type="annual",
        fiscal_year=2024,
        value=Decimal("20000000000"),
        period_end=date(2024, 6, 30),
        filed_date=date(2024, 8, 1),
        source_form="10-K",
    )

    return company


@pytest.mark.django_db
def test_company_detail_includes_related_metrics(api_client, company):
    response = api_client.get("/api/companies/msft/")

    assert response.status_code == 200
    payload = response.json()

    assert payload["ticker"] == "MSFT"
    assert payload["name"] == "Microsoft Corporation"
    assert payload["pe_ratio"] == 28.4
    assert payload["dividend_yield"] == 0.0085
    assert payload["revenue_growth_yoy"] == 0.12
    assert payload["net_margin"] == 0.36
    assert payload["free_cash_flow"] == 100000000000.0
    assert payload["latest_revenue"] == 245122000000.0


@pytest.mark.django_db
def test_company_detail_returns_404_for_unknown_ticker(api_client):
    response = api_client.get("/api/companies/UNKNOWN/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_company_list_search_returns_paginated_results(api_client, company):
    Company.objects.create(
        cik="0001326801",
        ticker="META",
        name="Meta Platforms, Inc.",
        sector="Communication Services",
        industry="Internet Services",
    )

    response = api_client.get("/api/companies/", {"search": "Micro"})

    assert response.status_code == 200
    payload = response.json()

    assert payload["count"] == 1
    assert payload["results"][0]["ticker"] == "MSFT"


@pytest.mark.django_db
def test_company_list_returns_empty_results_when_search_has_no_match(api_client, company):
    response = api_client.get("/api/companies/", {"search": "ZZZZZZ"})

    assert response.status_code == 200
    payload = response.json()

    assert payload["count"] == 0
    assert payload["results"] == []


@pytest.mark.django_db
def test_company_list_honors_pagination_boundary(api_client, company):
    for idx in range(30):
        Company.objects.create(
            cik=f"{idx + 1000000}",
            ticker=f"T{idx:03d}",
            name=f"Test Company {idx:03d}",
            sector="Utilities",
            industry="Power",
        )

    response = api_client.get("/api/companies/", {"page": 2})

    assert response.status_code == 200
    payload = response.json()

    assert payload["count"] == 31
    assert len(payload["results"]) == 6


@pytest.mark.django_db
def test_financials_endpoint_filters_metric_period_and_year(api_client, company):
    response = api_client.get(
        "/api/companies/MSFT/financials/",
        {
            "metrics": "revenue",
            "period_type": "annual",
            "start_year": "2024",
        },
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["ticker"] == "MSFT"
    assert payload["period_type"] == "annual"
    assert payload["available_metrics"] == ["revenue"]
    assert len(payload["facts"]) == 1
    assert payload["facts"][0]["metric_key"] == "revenue"
    assert payload["facts"][0]["fiscal_year"] == 2024
    assert payload["facts"][0]["period_end"] == "2024-06-30"
    assert payload["facts"][0]["source_form"] == "10-K"
    assert payload["facts"][0]["value"] == "245122000000.000000"


@pytest.mark.django_db
def test_financials_endpoint_returns_empty_envelope_for_company_without_facts(api_client):
    company = Company.objects.create(
        cik="0000000123",
        ticker="EMTY",
        name="Empty Co",
    )

    response = api_client.get("/api/companies/EMTY/financials/", {"period_type": "annual"})

    assert response.status_code == 200
    payload = response.json()

    assert payload["ticker"] == company.ticker
    assert payload["facts"] == []
    assert payload["available_metrics"] == []


@pytest.mark.django_db
def test_valuation_inputs_expose_earnings_and_cash_flow_modes(api_client, company):
    response = api_client.get("/api/companies/MSFT/valuation-inputs/")

    assert response.status_code == 200
    payload = response.json()

    assert payload["ticker"] == "MSFT"
    assert payload["projection_years_default"] == 5
    assert payload["warnings"] == []

    assert payload["earnings_mode"]["current_metric_label"] == "EPS"
    assert payload["earnings_mode"]["current_metric_value"] == pytest.approx(14.64, rel=1e-3)
    assert payload["earnings_mode"]["growth_rate_default"] == 20.0
    assert payload["earnings_mode"]["terminal_multiple_default"] == 28.4
    assert payload["earnings_mode"]["desired_return_default"] == 15.0

    assert payload["cash_flow_mode"]["current_metric_label"] == "FCF Per Share"
    assert payload["cash_flow_mode"]["current_metric_value"] == pytest.approx(13.46, rel=1e-3)
    assert payload["cash_flow_mode"]["growth_rate_default"] == 11.1
    assert payload["cash_flow_mode"]["terminal_multiple_default"] == pytest.approx(30.88, rel=1e-3)
    assert payload["cash_flow_mode"]["desired_return_default"] == 15.0


@pytest.mark.django_db
def test_prices_endpoint_returns_adjusted_close_when_available(api_client, company, monkeypatch):
    frame = pd.DataFrame(
        [
            {
                "Open": 410.12,
                "High": 418.55,
                "Low": 409.21,
                "Close": 415.67,
                "Adj Close": 413.42,
                "Volume": 25_000_000,
            }
        ],
        index=pd.to_datetime(["2026-03-20"]),
    )

    class FakeTicker:
        def __init__(self, ticker):
            self.ticker = ticker

        def history(self, period, auto_adjust=False):
            assert period == "1y"
            assert auto_adjust is False
            return frame

    monkeypatch.setattr(pricing_module.yf, "Ticker", lambda ticker: FakeTicker(ticker))

    response = api_client.get("/api/companies/MSFT/prices/", {"range": "1Y"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["stale"] is False
    assert payload["range"] == "1Y"
    assert payload["sampling_granularity"] == "trading-day"
    assert payload["data"][0]["close"] == 415.67
    assert payload["data"][0]["adjusted_close"] == 413.42


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("range_key", "expected_period", "expected_sampling"),
    [
        ("1M", "1mo", "daily"),
        ("3M", "3mo", "daily"),
        ("6M", "6mo", "daily"),
        ("1Y", "1y", "trading-day"),
        ("5Y", "5y", "weekly"),
        ("MAX", "max", "monthly"),
    ],
)
def test_prices_endpoint_supports_all_ranges(api_client, company, monkeypatch, range_key, expected_period, expected_sampling):
    frame = pd.DataFrame(
        [
            {
                "Open": 410.12,
                "High": 418.55,
                "Low": 409.21,
                "Close": 415.67,
                "Adj Close": 413.42,
                "Volume": 25_000_000,
            }
        ],
        index=pd.to_datetime(["2026-03-20"]),
    )

    class FakeTicker:
        def history(self, period, auto_adjust=False):
            assert period == expected_period
            assert auto_adjust is False
            return frame

    monkeypatch.setattr(pricing_module.yf, "Ticker", lambda ticker: FakeTicker())

    response = api_client.get(f"/api/companies/MSFT/prices/?range={range_key}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["range"] == range_key
    assert payload["sampling_granularity"] == expected_sampling
    assert len(payload["data"]) == 1


@pytest.mark.django_db
def test_prices_endpoint_serves_stale_cache_when_refresh_fails(api_client, company, monkeypatch):
    price_cache = PriceCache.objects.create(
        company=company,
        range_key="1Y",
        sampling_granularity="trading-day",
        data_json=[
            {
                "date": "2026-03-20",
                "open": 410.12,
                "high": 418.55,
                "low": 409.21,
                "close": 415.67,
                "adjusted_close": 413.42,
                "volume": 25_000_000,
            }
        ],
        is_stale=False,
        source_updated_at=timezone.now() - timedelta(hours=8),
    )
    PriceCache.objects.filter(pk=price_cache.pk).update(
        cached_at=timezone.now() - timedelta(hours=8)
    )

    class FakeTicker:
        def history(self, period, auto_adjust=False):
            raise RuntimeError("upstream unavailable")

    monkeypatch.setattr(pricing_module.yf, "Ticker", lambda ticker: FakeTicker())

    response = api_client.get("/api/companies/MSFT/prices/", {"range": "1Y"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["stale"] is True
    assert payload["data"][0]["adjusted_close"] == 413.42

    price_cache.refresh_from_db()
    assert price_cache.is_stale is True


@pytest.mark.django_db
def test_prices_endpoint_returns_503_without_cache_when_refresh_fails(api_client, company, monkeypatch):
    class FakeTicker:
        def history(self, period, auto_adjust=False):
            raise RuntimeError("upstream unavailable")

    monkeypatch.setattr(pricing_module.yf, "Ticker", lambda ticker: FakeTicker())

    response = api_client.get("/api/companies/MSFT/prices/", {"range": "1Y"})

    assert response.status_code == 503
    assert response.json()["message"] == "Price data unavailable. Retry."


@pytest.mark.django_db
def test_prices_endpoint_rejects_invalid_ranges(api_client, company):
    response = api_client.get("/api/companies/MSFT/prices/", {"range": "10Y"})

    assert response.status_code == 400
    assert "Invalid price range" in response.json()["message"]


@pytest.mark.django_db
def test_valuation_inputs_disable_financial_sector_companies(api_client):
    company = Company.objects.create(
        cik="0001067983",
        ticker="SCHW",
        name="Charles Schwab Corporation",
        sector="Financial Services",
        industry="Capital Markets",
        current_price=Decimal("70.00"),
        shares_outstanding=1_000_000_000,
    )
    MetricSnapshot.objects.create(company=company, pe_ratio=Decimal("20.00"))
    FinancialFact.objects.create(
        company=company,
        metric_key="diluted_eps",
        period_type="annual",
        fiscal_year=2024,
        value=Decimal("3.00"),
        period_end=date(2024, 12, 31),
        filed_date=date(2025, 2, 1),
        source_form="10-K",
    )

    response = api_client.get("/api/companies/SCHW/valuation-inputs/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["not_applicable"] is True
    assert payload["guardrails"]["financial_sector_disabled"] is True
    assert payload["earnings_mode"]["available"] is False
    assert payload["cash_flow_mode"]["available"] is False


@pytest.mark.django_db
def test_valuation_inputs_emit_negative_metric_warnings(api_client, company):
    FinancialFact.objects.filter(company=company, metric_key="diluted_eps").delete()
    FinancialFact.objects.create(
        company=company,
        metric_key="diluted_eps",
        period_type="annual",
        fiscal_year=2024,
        value=Decimal("-2.00"),
        period_end=date(2024, 6, 30),
        filed_date=date(2024, 8, 1),
        source_form="10-K",
    )
    FinancialFact.objects.filter(company=company, metric_key="free_cash_flow").delete()
    FinancialFact.objects.create(
        company=company,
        metric_key="free_cash_flow",
        period_type="annual",
        fiscal_year=2024,
        value=Decimal("-1000000000"),
        period_end=date(2024, 6, 30),
        filed_date=date(2024, 8, 1),
        source_form="10-K",
    )

    response = api_client.get("/api/companies/MSFT/valuation-inputs/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["guardrails"]["negative_earnings"] is True
    assert payload["guardrails"]["negative_free_cash_flow"] is True
    assert any("Trailing earnings are negative" in warning for warning in payload["warnings"])
    assert any("Free cash flow is currently negative" in warning for warning in payload["warnings"])


@pytest.mark.django_db
def test_valuation_inputs_require_shares_for_cash_flow_mode(api_client, company):
    company.shares_outstanding = None
    company.save(update_fields=["shares_outstanding"])

    response = api_client.get("/api/companies/MSFT/valuation-inputs/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["guardrails"]["missing_shares_outstanding"] is True
    assert payload["cash_flow_mode"]["available"] is False
    assert "shares outstanding" in payload["cash_flow_mode"]["availability_reason"].lower()


@pytest.mark.django_db
def test_screener_filters_sorts_and_returns_empty(api_client):
    alpha = Company.objects.create(
        cik="0000000001",
        ticker="ALFA",
        name="Alpha Tech",
        sector="Technology",
        industry="Software",
        current_price=Decimal("110.00"),
        market_cap=500_000_000_000,
    )
    beta = Company.objects.create(
        cik="0000000002",
        ticker="BETA",
        name="Beta Finance",
        sector="Financial Services",
        industry="Capital Markets",
        current_price=Decimal("55.00"),
        market_cap=80_000_000_000,
    )
    MetricSnapshot.objects.create(
        company=alpha,
        pe_ratio=Decimal("25.0"),
        revenue_growth_yoy=Decimal("0.18"),
        gross_margin=Decimal("0.70"),
        operating_margin=Decimal("0.33"),
        debt_to_equity=Decimal("0.15"),
        free_cash_flow=Decimal("1000000000"),
    )
    MetricSnapshot.objects.create(
        company=beta,
        pe_ratio=Decimal("12.0"),
        revenue_growth_yoy=Decimal("0.03"),
        gross_margin=None,
        operating_margin=Decimal("0.20"),
        debt_to_equity=Decimal("1.80"),
        free_cash_flow=Decimal("-500000000"),
    )

    response = api_client.get(
        "/api/screener/",
        {
            "sector": "Technology",
            "positive_fcf": "true",
            "sort": "revenue_growth_yoy",
            "order": "desc",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["ticker"] == "ALFA"
    assert payload["results"][0]["industry"] == "Software"

    empty_response = api_client.get(
        "/api/screener/",
        {
            "industry": "Insurance",
            "positive_fcf": "true",
        },
    )
    assert empty_response.status_code == 200
    assert empty_response.json()["count"] == 0
