from datetime import date
from decimal import Decimal
import sys
import types

import pandas as pd
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from stocks.models import Company, FinancialFact, MetricSnapshot


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

        def history(self, period):
            assert period == "1y"
            return frame

    monkeypatch.setitem(sys.modules, "yfinance", types.SimpleNamespace(Ticker=FakeTicker))

    response = api_client.get("/api/companies/MSFT/prices/", {"range": "1Y"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["stale"] is False
    assert payload["data"][0]["close"] == 415.67
    assert payload["data"][0]["adjusted_close"] == 413.42
