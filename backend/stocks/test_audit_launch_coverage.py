from datetime import date
from decimal import Decimal

import pytest
from django.core.management import call_command

from stocks.models import Company, FinancialFact, MetricSnapshot, RawSecPayload


def _annual_fact(company, metric_key, value):
    return FinancialFact.objects.create(
        company=company,
        metric_key=metric_key,
        period_type=FinancialFact.PERIOD_ANNUAL,
        fiscal_year=2024,
        fiscal_quarter=None,
        period_start=date(2024, 1, 1),
        period_end=date(2024, 12, 31),
        value=Decimal(value),
        unit="USD",
        source_tag=f"{metric_key}_2024",
        source_form="10-K",
        filed_date=date(2025, 2, 1),
        is_amended=False,
        is_derived=False,
        selection_reason="test",
    )


def _companyfacts_payload(*tags):
    return {
        "facts": {
            "us-gaap": {
                tag: {
                    "units": {
                        "USD": [
                            {
                                "fy": 2024,
                                "fp": "FY",
                                "form": "10-K",
                                "filed": "2025-02-01",
                                "start": "2024-01-01",
                                "end": "2024-12-31",
                                "val": 100,
                            }
                        ]
                    }
                }
                for tag in tags
            }
        }
    }


@pytest.mark.django_db
def test_audit_launch_coverage_writes_markdown_report(tmp_path):
    alpha = Company.objects.create(cik="0000000001", ticker="ALPHA", name="Alpha Inc.")
    beta = Company.objects.create(cik="0000000002", ticker="BETA", name="Beta Inc.")

    RawSecPayload.objects.create(
        company=alpha,
        source=RawSecPayload.SOURCE_COMPANYFACTS,
        status=RawSecPayload.STATUS_SUCCESS,
        payload_json=_companyfacts_payload("GrossProfit"),
        retention_note="latest_success",
    )
    RawSecPayload.objects.create(
        company=beta,
        source=RawSecPayload.SOURCE_COMPANYFACTS,
        status=RawSecPayload.STATUS_SUCCESS,
        payload_json=_companyfacts_payload("GrossProfit"),
        retention_note="latest_success",
    )

    for metric_key in (
        "revenue",
        "gross_profit",
        "operating_income",
        "net_income",
        "cash_and_equivalents",
        "total_debt",
        "shares_outstanding",
    ):
        _annual_fact(alpha, metric_key, "100")

    for metric_key in (
        "revenue",
        "operating_income",
        "net_income",
        "cash_and_equivalents",
        "total_debt",
        "shares_outstanding",
    ):
        _annual_fact(beta, metric_key, "100")

    MetricSnapshot.objects.create(
        company=alpha,
        free_cash_flow=Decimal("80.00"),
        revenue_growth_yoy=Decimal("0.1200"),
        gross_margin=Decimal("0.5000"),
        operating_margin=Decimal("0.2500"),
        net_margin=Decimal("0.1800"),
    )
    MetricSnapshot.objects.create(
        company=beta,
        revenue_growth_yoy=Decimal("0.0800"),
        operating_margin=Decimal("0.2000"),
        net_margin=Decimal("0.1500"),
    )

    output_path = tmp_path / "coverage.md"

    call_command("audit_launch_coverage", "--output", str(output_path))

    report = output_path.read_text(encoding="utf-8")

    assert "# Launch Coverage Audit" in report
    assert "- Universe size: 2" in report
    assert "- Threshold: 95.0%" in report
    assert "- Overall result: FAIL" in report
    assert "| revenue | financial_fact | 2 | 0 | 2 | 0 | 100.0% | PASS |" in report
    assert "| gross_profit | financial_fact | 2 | 0 | 1 | 1 | 50.0% | FAIL |" in report
    assert "| free_cash_flow | metric_snapshot | 2 | 0 | 1 | 1 | 50.0% | FAIL |" in report
    assert "| gross_margin | metric_snapshot | 2 | 0 | 1 | 1 | 50.0% | FAIL |" in report
    assert "### gross_profit" in report
    assert "Missing tickers (1): BETA" in report


@pytest.mark.django_db
def test_audit_launch_coverage_prints_gap_free_report(capsys):
    company = Company.objects.create(cik="0000000003", ticker="OMEGA", name="Omega Inc.")

    RawSecPayload.objects.create(
        company=company,
        source=RawSecPayload.SOURCE_COMPANYFACTS,
        status=RawSecPayload.STATUS_SUCCESS,
        payload_json=_companyfacts_payload("GrossProfit"),
        retention_note="latest_success",
    )

    for metric_key in (
        "revenue",
        "gross_profit",
        "operating_income",
        "net_income",
        "cash_and_equivalents",
        "total_debt",
        "shares_outstanding",
    ):
        _annual_fact(company, metric_key, "100")

    MetricSnapshot.objects.create(
        company=company,
        free_cash_flow=Decimal("90.00"),
        revenue_growth_yoy=Decimal("0.1100"),
        gross_margin=Decimal("0.5100"),
        operating_margin=Decimal("0.2400"),
        net_margin=Decimal("0.1700"),
    )

    call_command("audit_launch_coverage")
    captured = capsys.readouterr()

    assert "- Overall result: PASS" in captured.out
    assert "No gaps detected in the current universe." in captured.out
