from stocks.metric_registry import (
    ANNUAL,
    QUARTERLY,
    get_metric_definition,
    list_metric_keys,
    supports_period,
    tag_priority,
    unit_matches_family,
)


def test_metric_registry_locks_the_v1_metric_set():
    assert set(list_metric_keys()) == {
        "revenue",
        "gross_profit",
        "operating_income",
        "net_income",
        "diluted_eps",
        "operating_cash_flow",
        "capital_expenditures",
        "free_cash_flow",
        "cash_and_equivalents",
        "total_debt",
        "shareholders_equity",
        "shares_outstanding",
    }


def test_metric_registry_encodes_required_contract_fields():
    revenue = get_metric_definition("revenue")
    assert revenue.metric_class == "duration"
    assert revenue.allowed_unit_family == "USD"
    assert revenue.preferred_tags[:3] == (
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "Revenues",
    )
    assert revenue.supported_periods == (ANNUAL, QUARTERLY)

    diluted_eps = get_metric_definition("diluted_eps")
    assert diluted_eps.metric_class == "per_share"
    assert diluted_eps.allowed_unit_family == "USD/share"

    free_cash_flow = get_metric_definition("free_cash_flow")
    assert free_cash_flow.metric_class == "derived"
    assert free_cash_flow.preferred_tags == ()


def test_registry_helpers_are_deterministic():
    assert unit_matches_family("USD", "USD") is True
    assert unit_matches_family("usd/shares", "USD/share") is True
    assert unit_matches_family("Shares", "shares") is True
    assert unit_matches_family("shares", "USD") is False

    assert supports_period("net_income", ANNUAL) is True
    assert supports_period("net_income", QUARTERLY) is True
    assert tag_priority("revenue", "RevenueFromContractWithCustomerExcludingAssessedTax") == 0
    assert tag_priority("revenue", "SalesRevenueNet") > 0
