import csv
from pathlib import Path

import pytest
from django.core.management import call_command

from stocks.models import Company


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
