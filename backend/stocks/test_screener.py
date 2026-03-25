import pytest

from stocks.models import Company, MetricSnapshot
from stocks.screener import build_screener_queryset


@pytest.mark.django_db
def test_build_screener_queryset_applies_sector_and_positive_fcf_filters():
    tech = Company.objects.create(ticker="TECH", name="Tech Corp", cik="1", sector="Technology")
    bank = Company.objects.create(ticker="BANK", name="Bank Corp", cik="2", sector="Financials")

    MetricSnapshot.objects.create(company=tech, free_cash_flow=10, pe_ratio=25)
    MetricSnapshot.objects.create(company=bank, free_cash_flow=-5, pe_ratio=8)

    queryset = build_screener_queryset({
        "sector": "Technology",
        "positive_fcf": "true",
    })

    assert list(queryset.values_list("company__ticker", flat=True)) == ["TECH"]


@pytest.mark.django_db
def test_build_screener_queryset_ignores_invalid_range_filters():
    company = Company.objects.create(ticker="SAFE", name="Safe Corp", cik="3", sector="Utilities")
    MetricSnapshot.objects.create(company=company, pe_ratio=12.5)

    queryset = build_screener_queryset({
        "pe_min": "not-a-number",
        "sort": "ticker",
        "order": "asc",
    })

    assert list(queryset.values_list("company__ticker", flat=True)) == ["SAFE"]


@pytest.mark.django_db
def test_build_screener_queryset_uses_market_cap_sort_as_safe_default():
    alpha = Company.objects.create(ticker="ALFA", name="Alpha", cik="10", market_cap=100)
    beta = Company.objects.create(ticker="BETA", name="Beta", cik="11", market_cap=200)
    MetricSnapshot.objects.create(company=alpha)
    MetricSnapshot.objects.create(company=beta)

    queryset = build_screener_queryset({
        "sort": "not-real",
        "order": "desc",
    })

    assert list(queryset.values_list("company__ticker", flat=True)) == ["BETA", "ALFA"]
