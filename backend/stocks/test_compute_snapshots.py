from datetime import date
from decimal import Decimal

import pytest
from django.core.management import call_command

from stocks.models import Company, FinancialFact, IngestionRun, MetricSnapshot


def _annual_fact(company, metric_key, fiscal_year, value, *, period_end=None):
    return FinancialFact.objects.create(
        company=company,
        metric_key=metric_key,
        period_type=FinancialFact.PERIOD_ANNUAL,
        fiscal_year=fiscal_year,
        fiscal_quarter=None,
        period_start=date(fiscal_year, 1, 1),
        period_end=period_end or date(fiscal_year, 12, 31),
        value=Decimal(value),
        unit="USD",
        source_tag=f"{metric_key}_{fiscal_year}",
        source_form="10-K",
        filed_date=date(fiscal_year + 1, 2, 1),
        is_amended=False,
        is_derived=False,
        selection_reason="test",
    )


@pytest.mark.django_db
def test_compute_snapshots_creates_canonical_snapshot():
    company = Company.objects.create(
        cik="0000320193",
        ticker="AAPL",
        name="Apple Inc.",
        current_price=Decimal("100.00"),
    )
    _annual_fact(company, "revenue", 2023, "1000")
    _annual_fact(company, "revenue", 2024, "1200")
    _annual_fact(company, "gross_profit", 2024, "600")
    _annual_fact(company, "operating_income", 2024, "300")
    _annual_fact(company, "net_income", 2024, "180")
    _annual_fact(company, "diluted_eps", 2024, "8")
    _annual_fact(company, "shareholders_equity", 2024, "600")
    _annual_fact(company, "total_debt", 2024, "300")
    _annual_fact(company, "operating_cash_flow", 2024, "250")
    _annual_fact(company, "capital_expenditures", 2024, "50")

    call_command("compute_snapshots")

    snapshot = MetricSnapshot.objects.get(company=company)
    run = IngestionRun.objects.get(source=IngestionRun.SOURCE_SNAPSHOTS)

    assert snapshot.pe_ratio == Decimal("12.50")
    assert snapshot.dividend_yield is None
    assert snapshot.revenue_growth_yoy == Decimal("0.2000")
    assert snapshot.gross_margin == Decimal("0.5000")
    assert snapshot.operating_margin == Decimal("0.2500")
    assert snapshot.net_margin == Decimal("0.1500")
    assert snapshot.roe == Decimal("0.3000")
    assert snapshot.debt_to_equity == Decimal("0.5000")
    assert snapshot.free_cash_flow == Decimal("200.00")
    assert run.status == IngestionRun.STATUS_SUCCESS
    assert run.details_json["processed"] == 1
    assert run.details_json["created"] == 1


@pytest.mark.django_db
def test_compute_snapshots_is_idempotent_and_overwrites_existing_snapshot():
    company = Company.objects.create(
        cik="0000789019",
        ticker="MSFT",
        name="Microsoft Corp.",
        current_price=Decimal("90.00"),
    )
    _annual_fact(company, "revenue", 2023, "100")
    _annual_fact(company, "revenue", 2024, "120")
    _annual_fact(company, "net_income", 2024, "24")
    _annual_fact(company, "diluted_eps", 2024, "6")
    _annual_fact(company, "shareholders_equity", 2024, "60")
    _annual_fact(company, "total_debt", 2024, "30")

    original = MetricSnapshot.objects.create(
        company=company,
        pe_ratio=Decimal("999.99"),
        net_margin=Decimal("0.9999"),
    )

    call_command("compute_snapshots")
    call_command("compute_snapshots")

    snapshot = MetricSnapshot.objects.get(company=company)

    assert MetricSnapshot.objects.count() == 1
    assert snapshot.pk == original.pk
    assert snapshot.pe_ratio == Decimal("15.00")
    assert snapshot.net_margin == Decimal("0.2000")
    assert snapshot.roe == Decimal("0.4000")
    assert snapshot.debt_to_equity == Decimal("0.5000")


@pytest.mark.django_db
def test_compute_snapshots_deletes_stale_snapshot_without_annual_facts():
    company = Company.objects.create(
        cik="0001652044",
        ticker="GOOG",
        name="Alphabet Inc.",
    )
    MetricSnapshot.objects.create(
        company=company,
        pe_ratio=Decimal("30.00"),
    )

    call_command("compute_snapshots")

    assert not MetricSnapshot.objects.filter(company=company).exists()
