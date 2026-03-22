import json
from pathlib import Path

from stocks.normalization import derive_quarter_from_ytd, select_annual_fact


FIXTURES_DIR = Path(__file__).resolve().parent / "tests" / "fixtures" / "normalization"


def load_fixture(name):
    return json.loads((FIXTURES_DIR / name).read_text(encoding="utf-8"))


def test_select_annual_fact_prefers_latest_amended_filing():
    entries = load_fixture("annual_amended.json")

    selected = select_annual_fact(entries, allowed_unit="USD")

    assert selected is not None
    assert selected["form"] == "10-K/A"
    assert selected["val"] == 105
    assert selected["is_amended"] is True


def test_select_annual_fact_rejects_mixed_units():
    entries = load_fixture("annual_mixed_units.json")

    selected = select_annual_fact(entries, allowed_unit="USD")

    assert selected is not None
    assert selected["unit"] == "USD"
    assert selected["val"] == 250
    assert selected["tag"] == "SalesRevenueNet"


def test_derive_quarter_from_ytd_is_deterministic():
    fixture = load_fixture("quarter_ytd.json")

    derived = derive_quarter_from_ytd(
        fixture["previous_ytd"],
        fixture["current_ytd"],
    )

    assert derived is not None
    assert derived["value"] == 130
    assert derived["fiscal_year"] == 2024
    assert derived["fiscal_quarter"] == 2
    assert derived["is_derived"] is True
    assert derived["selection_reason"] == "derived_from_ytd"
