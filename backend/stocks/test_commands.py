import csv
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from django.core.management import call_command

from stocks.management.commands import ingest_financials as ingest_financials_command
from stocks.management.commands import update_prices as update_prices_command
from stocks.models import Company, FinancialFact, IngestionRun, RawSecPayload


SEED_25_CSV = (
    Path(__file__).resolve().parent / "data" / "sp500_seed_25.csv"
)


def test_seed_fixture_contains_25_rows():
    with open(SEED_25_CSV, newline="", encoding="utf-8") as fixture_file:
        rows = list(csv.DictReader(fixture_file))

    assert len(rows) == 25
    assert {row["sector"] for row in rows} >= {
        "Technology",
        "Healthcare",
        "Financial Services",
        "Communication Services",
        "Consumer Cyclical",
        "Consumer Defensive",
        "Energy",
        "Industrials",
        "Basic Materials",
    }


@pytest.mark.django_db
def test_ingest_companies_supports_csv_override(tmp_path):
    csv_path = tmp_path / "companies.csv"
    csv_path.write_text(
        "ticker,name,sector,industry,cik\n"
        "TEST,Test Corp,Technology,Software,123456\n",
        encoding="utf-8",
    )

    call_command("ingest_companies", "--csv", str(csv_path))

    company = Company.objects.get(ticker="TEST")
    assert company.name == "Test Corp"
    assert company.sector == "Technology"
    assert company.industry == "Software"
    assert company.cik == "123456"


def _duration_entry(*, value, start, end, fy, fp, form, filed):
    return {
        "val": value,
        "start": start,
        "end": end,
        "fy": fy,
        "fp": fp,
        "form": form,
        "filed": filed,
    }


def _instant_entry(*, value, end, fy, fp, form, filed):
    return {
        "val": value,
        "end": end,
        "fy": fy,
        "fp": fp,
        "form": form,
        "filed": filed,
    }


def _sample_companyfacts_payload():
    return {
        "facts": {
            "us-gaap": {
                "RevenueFromContractWithCustomerExcludingAssessedTax": {
                    "units": {
                        "USD": [
                            _duration_entry(
                                value=1000,
                                start="2024-01-01",
                                end="2024-12-31",
                                fy=2024,
                                fp="FY",
                                form="10-K",
                                filed="2025-02-01",
                            ),
                            _duration_entry(
                                value=1100,
                                start="2024-01-01",
                                end="2024-12-31",
                                fy=2024,
                                fp="FY",
                                form="10-K/A",
                                filed="2025-02-15",
                            ),
                            _duration_entry(
                                value=250,
                                start="2024-01-01",
                                end="2024-03-31",
                                fy=2024,
                                fp="Q1",
                                form="10-Q",
                                filed="2024-05-01",
                            ),
                            _duration_entry(
                                value=600,
                                start="2024-01-01",
                                end="2024-06-30",
                                fy=2024,
                                fp="Q2",
                                form="10-Q",
                                filed="2024-08-01",
                            ),
                            _duration_entry(
                                value=900,
                                start="2024-01-01",
                                end="2024-09-30",
                                fy=2024,
                                fp="Q3",
                                form="10-Q",
                                filed="2024-11-01",
                            ),
                        ]
                    }
                },
                "NetCashProvidedByUsedInOperatingActivities": {
                    "units": {
                        "USD": [
                            _duration_entry(
                                value=400,
                                start="2024-01-01",
                                end="2024-12-31",
                                fy=2024,
                                fp="FY",
                                form="10-K",
                                filed="2025-02-01",
                            ),
                            _duration_entry(
                                value=90,
                                start="2024-01-01",
                                end="2024-03-31",
                                fy=2024,
                                fp="Q1",
                                form="10-Q",
                                filed="2024-05-01",
                            ),
                            _duration_entry(
                                value=220,
                                start="2024-01-01",
                                end="2024-06-30",
                                fy=2024,
                                fp="Q2",
                                form="10-Q",
                                filed="2024-08-01",
                            ),
                            _duration_entry(
                                value=330,
                                start="2024-01-01",
                                end="2024-09-30",
                                fy=2024,
                                fp="Q3",
                                form="10-Q",
                                filed="2024-11-01",
                            ),
                        ]
                    }
                },
                "PaymentsToAcquirePropertyPlantAndEquipment": {
                    "units": {
                        "USD": [
                            _duration_entry(
                                value=120,
                                start="2024-01-01",
                                end="2024-12-31",
                                fy=2024,
                                fp="FY",
                                form="10-K",
                                filed="2025-02-01",
                            ),
                            _duration_entry(
                                value=20,
                                start="2024-01-01",
                                end="2024-03-31",
                                fy=2024,
                                fp="Q1",
                                form="10-Q",
                                filed="2024-05-01",
                            ),
                            _duration_entry(
                                value=60,
                                start="2024-01-01",
                                end="2024-06-30",
                                fy=2024,
                                fp="Q2",
                                form="10-Q",
                                filed="2024-08-01",
                            ),
                            _duration_entry(
                                value=90,
                                start="2024-01-01",
                                end="2024-09-30",
                                fy=2024,
                                fp="Q3",
                                form="10-Q",
                                filed="2024-11-01",
                            ),
                        ]
                    }
                },
            },
            "dei": {
                "EntityCommonStockSharesOutstanding": {
                    "units": {
                        "shares": [
                            _instant_entry(
                                value=1000,
                                end="2024-12-31",
                                fy=2024,
                                fp="FY",
                                form="10-K",
                                filed="2025-02-01",
                            ),
                            _instant_entry(
                                value=950,
                                end="2024-09-30",
                                fy=2024,
                                fp="Q3",
                                form="10-Q",
                                filed="2024-11-01",
                            ),
                        ]
                    }
                }
            },
        }
    }


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class _FakeSecSession:
    def __init__(self, companyfacts_payload, submissions_payload):
        self.headers = {}
        self._companyfacts_payload = companyfacts_payload
        self._submissions_payload = submissions_payload

    def get(self, url, timeout):
        if "companyfacts" in url:
            return _FakeResponse(self._companyfacts_payload)
        if "submissions" in url:
            return _FakeResponse(self._submissions_payload)
        raise AssertionError(f"Unexpected SEC URL: {url}")


@pytest.mark.django_db
def test_ingest_financials_builds_canonical_facts_and_audit_records(monkeypatch):
    payload = _sample_companyfacts_payload()
    submissions_payload = {"filings": {"recent": {"form": ["10-Q", "10-K"]}}}
    company = Company.objects.create(ticker="TEST", name="Test Corp", cik="1234567890")

    monkeypatch.setattr(ingest_financials_command, "REQUEST_INTERVAL", 0)
    monkeypatch.setattr(
        ingest_financials_command.requests,
        "Session",
        lambda: _FakeSecSession(payload, submissions_payload),
    )

    call_command("ingest_financials", "--ticker", "TEST")

    company.refresh_from_db()

    revenue_annual = FinancialFact.objects.get(
        company=company,
        metric_key="revenue",
        period_type="annual",
        fiscal_year=2024,
    )
    revenue_q2 = FinancialFact.objects.get(
        company=company,
        metric_key="revenue",
        period_type="quarterly",
        fiscal_year=2024,
        fiscal_quarter=2,
    )
    revenue_q4 = FinancialFact.objects.get(
        company=company,
        metric_key="revenue",
        period_type="quarterly",
        fiscal_year=2024,
        fiscal_quarter=4,
    )
    free_cash_flow_annual = FinancialFact.objects.get(
        company=company,
        metric_key="free_cash_flow",
        period_type="annual",
        fiscal_year=2024,
    )
    shares_annual = FinancialFact.objects.get(
        company=company,
        metric_key="shares_outstanding",
        period_type="annual",
        fiscal_year=2024,
    )

    assert revenue_annual.value == Decimal("1100")
    assert revenue_annual.source_form == "10-K/A"
    assert revenue_annual.is_amended is True
    assert revenue_q2.value == Decimal("350")
    assert revenue_q2.is_derived is True
    assert revenue_q2.selection_reason == "derived_from_ytd"
    assert revenue_q4.value == Decimal("200")
    assert revenue_q4.selection_reason == "derived_q4_from_annual"
    assert free_cash_flow_annual.value == Decimal("280")
    assert shares_annual.value == Decimal("1000")
    assert shares_annual.source_tag == "EntityCommonStockSharesOutstanding"
    assert company.facts_updated_at is not None

    run = IngestionRun.objects.get(company=company, source=IngestionRun.SOURCE_SEC)
    raw_companyfacts = RawSecPayload.objects.get(
        company=company,
        source=RawSecPayload.SOURCE_COMPANYFACTS,
    )
    raw_submissions = RawSecPayload.objects.get(
        company=company,
        source=RawSecPayload.SOURCE_SUBMISSIONS,
    )

    assert run.status == IngestionRun.STATUS_SUCCESS
    assert run.details_json["raw_payload_ids"] == {
        "companyfacts": raw_companyfacts.id,
        "submissions": raw_submissions.id,
    }
    assert run.details_json["facts_replaced"] == FinancialFact.objects.filter(company=company).count()
    assert raw_companyfacts.status == RawSecPayload.STATUS_SUCCESS
    assert raw_companyfacts.payload_json == payload
    assert raw_submissions.status == RawSecPayload.STATUS_SUCCESS
    assert raw_submissions.payload_json == submissions_payload


@pytest.mark.django_db
def test_ingest_financials_respects_cooldown_and_force_is_idempotent(monkeypatch):
    payload = _sample_companyfacts_payload()
    submissions_payload = {"filings": {"recent": {"form": ["10-Q", "10-K"]}}}
    company = Company.objects.create(ticker="TEST", name="Test Corp", cik="1234567890")

    monkeypatch.setattr(ingest_financials_command, "REQUEST_INTERVAL", 0)
    monkeypatch.setattr(
        ingest_financials_command.requests,
        "Session",
        lambda: _FakeSecSession(payload, submissions_payload),
    )

    call_command("ingest_financials", "--ticker", "TEST")
    initial_fact_count = FinancialFact.objects.filter(company=company).count()

    call_command("ingest_financials", "--ticker", "TEST")
    assert IngestionRun.objects.filter(company=company, source=IngestionRun.SOURCE_SEC).count() == 1
    assert RawSecPayload.objects.filter(company=company, source=RawSecPayload.SOURCE_COMPANYFACTS).count() == 1
    assert RawSecPayload.objects.filter(company=company, source=RawSecPayload.SOURCE_SUBMISSIONS).count() == 1

    call_command("ingest_financials", "--ticker", "TEST", "--force")

    assert IngestionRun.objects.filter(company=company, source=IngestionRun.SOURCE_SEC).count() == 2
    assert RawSecPayload.objects.filter(company=company, source=RawSecPayload.SOURCE_COMPANYFACTS).count() == 1
    assert RawSecPayload.objects.filter(company=company, source=RawSecPayload.SOURCE_SUBMISSIONS).count() == 1
    assert FinancialFact.objects.filter(company=company).count() == initial_fact_count
    assert FinancialFact.objects.filter(
        company=company,
        metric_key="revenue",
        period_type="annual",
        fiscal_year=2024,
    ).count() == 1


@pytest.mark.django_db
def test_update_prices_uses_ingestion_run_and_quote_timestamp(monkeypatch):
    company = Company.objects.create(ticker="TEST", name="Test Corp", cik="1234567890")

    class FakeTicker:
        info = {
            "regularMarketPrice": 123.45,
            "marketCap": 987654321,
            "fiftyTwoWeekHigh": 140.10,
            "fiftyTwoWeekLow": 99.50,
            "sharesOutstanding": 7654321,
        }

    monkeypatch.setattr(update_prices_command.yf, "Ticker", lambda ticker: FakeTicker())

    call_command("update_prices", "--ticker", "TEST")

    company.refresh_from_db()
    run = IngestionRun.objects.get(company=company, source=IngestionRun.SOURCE_PRICES)

    assert company.current_price == Decimal("123.45")
    assert company.market_cap == 987654321
    assert company.week_52_high == Decimal("140.10")
    assert company.week_52_low == Decimal("99.50")
    assert company.shares_outstanding == 7654321
    assert company.quote_updated_at is not None
    assert run.status == IngestionRun.STATUS_SUCCESS
    assert run.details_json == {"records_updated": 1}


@pytest.mark.django_db
def test_ingest_financials_dedupes_period_end_collisions_deterministically():
    company = Company.objects.create(ticker="DUP", name="Duplicate Corp", cik="9999999999")
    command = ingest_financials_command.Command()

    quarter_fact = FinancialFact(
        company=company,
        metric_key="net_income",
        period_type=FinancialFact.PERIOD_QUARTERLY,
        fiscal_year=2024,
        fiscal_quarter=2,
        period_start=None,
        period_end=date(2024, 6, 30),
        value=Decimal("10"),
        unit="USD",
        source_tag="NetIncomeLoss",
        source_form="10-Q",
        filed_date=date(2024, 8, 1),
        selection_reason="selected_quarterly_fact",
    )
    annual_collision = FinancialFact(
        company=company,
        metric_key="net_income",
        period_type=FinancialFact.PERIOD_QUARTERLY,
        fiscal_year=2024,
        fiscal_quarter=4,
        period_start=None,
        period_end=date(2024, 6, 30),
        value=Decimal("11"),
        unit="USD",
        source_tag="NetIncomeLoss",
        source_form="10-K",
        filed_date=date(2025, 2, 1),
        selection_reason="selected_quarterly_fact",
    )

    deduped, collisions = command._dedupe_fact_models([annual_collision, quarter_fact])

    assert collisions == 1
    assert len(deduped) == 1
    assert deduped[0].fiscal_quarter == 2
    assert deduped[0].source_form == "10-Q"
