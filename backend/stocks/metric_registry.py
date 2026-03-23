from dataclasses import dataclass


ANNUAL = "annual"
QUARTERLY = "quarterly"


@dataclass(frozen=True)
class MetricDefinition:
    metric_key: str
    metric_class: str
    allowed_unit_family: str
    preferred_tags: tuple[str, ...]
    supported_periods: tuple[str, ...]


_BOTH_PERIODS = (ANNUAL, QUARTERLY)

_METRICS = (
    MetricDefinition(
        metric_key="revenue",
        metric_class="duration",
        allowed_unit_family="USD",
        preferred_tags=(
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "RevenueFromContractWithCustomerIncludingAssessedTax",
            "Revenues",
            "SalesRevenueNet",
            "SalesRevenueGoodsNet",
            "SalesRevenueServicesNet",
            "TotalRevenuesAndOtherIncome",
            "InterestAndDividendIncomeOperating",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="cost_of_revenue",
        metric_class="duration",
        allowed_unit_family="USD",
        preferred_tags=(
            "CostOfRevenue",
            "CostOfGoodsAndServicesSold",
            "CostOfServices",
            "CostOfGoodsSold",
            "CostOfGoodsAndServicesSoldDepreciationAndAmortization",
            "CostOfServicesDepreciationAndAmortization",
            "CostOfGoodsSoldDepreciationAndAmortization",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="gross_profit",
        metric_class="duration",
        allowed_unit_family="USD",
        preferred_tags=("GrossProfit",),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="operating_income",
        metric_class="duration",
        allowed_unit_family="USD",
        preferred_tags=(
            "OperatingIncomeLoss",
            "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="net_income",
        metric_class="duration",
        allowed_unit_family="USD",
        preferred_tags=(
            "NetIncomeLoss",
            "NetIncomeLossAvailableToCommonStockholdersBasic",
            "ProfitLoss",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="diluted_eps",
        metric_class="per_share",
        allowed_unit_family="USD/share",
        preferred_tags=(
            "EarningsPerShareDiluted",
            "EarningsPerShareBasicAndDiluted",
            "EarningsPerShareBasic",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="operating_cash_flow",
        metric_class="duration",
        allowed_unit_family="USD",
        preferred_tags=(
            "NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="capital_expenditures",
        metric_class="duration",
        allowed_unit_family="USD",
        preferred_tags=(
            "PaymentsToAcquirePropertyPlantAndEquipment",
            "PaymentsToAcquireOtherPropertyPlantAndEquipment",
            "PaymentsToAcquireOilAndGasProperty",
            "PaymentsToAcquireProductiveAssets",
            "PaymentsForCapitalImprovements",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="free_cash_flow",
        metric_class="derived",
        allowed_unit_family="USD",
        preferred_tags=(),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="cash_and_equivalents",
        metric_class="instant",
        allowed_unit_family="USD",
        preferred_tags=(
            "CashAndCashEquivalentsAtCarryingValue",
            "CashCashEquivalentsAndShortTermInvestments",
            "Cash",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="total_debt",
        metric_class="instant",
        allowed_unit_family="USD",
        preferred_tags=(
            "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities",
            "DebtAndCapitalLeaseObligations",
            "LongTermDebtAndCapitalLeaseObligations",
            "DebtInstrumentCarryingAmount",
            "DebtInstrumentFaceAmount",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="debt_current",
        metric_class="instant",
        allowed_unit_family="USD",
        preferred_tags=(
            "LongTermDebtAndCapitalLeaseObligationsCurrent",
            "LongTermDebtCurrent",
            "DebtCurrent",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="debt_noncurrent",
        metric_class="instant",
        allowed_unit_family="USD",
        preferred_tags=(
            "LongTermDebtAndCapitalLeaseObligations",
            "LongTermDebtNoncurrent",
            "LongTermDebt",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="shareholders_equity",
        metric_class="instant",
        allowed_unit_family="USD",
        preferred_tags=(
            "StockholdersEquity",
            "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
            "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="shares_outstanding",
        metric_class="instant",
        allowed_unit_family="shares",
        preferred_tags=(
            "CommonStockSharesOutstanding",
            "EntityCommonStockSharesOutstanding",
            "WeightedAverageNumberOfDilutedSharesOutstanding",
            "WeightedAverageNumberOfShareOutstandingBasicAndDiluted",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
    MetricDefinition(
        metric_key="dividends_per_share",
        metric_class="per_share",
        allowed_unit_family="USD/share",
        preferred_tags=(
            "CommonStockDividendsPerShareDeclared",
            "CommonStockDividendsPerShareCashPaid",
        ),
        supported_periods=_BOTH_PERIODS,
    ),
)


METRIC_REGISTRY = {metric.metric_key: metric for metric in _METRICS}

_UNIT_FAMILY_ALIASES = {
    "USD": frozenset({"usd"}),
    "USD/share": frozenset({"usd/share", "usd/shares"}),
    "shares": frozenset({"share", "shares"}),
}


def list_metric_keys():
    return tuple(METRIC_REGISTRY.keys())


def get_metric_definition(metric_key):
    return METRIC_REGISTRY[metric_key]


def get_metric_definition_or_none(metric_key):
    if not metric_key:
        return None
    return METRIC_REGISTRY.get(metric_key)


def unit_matches_family(unit, allowed_unit_family):
    normalized_unit = _normalize_unit(unit)
    normalized_allowed = _normalize_unit(allowed_unit_family)
    aliases = _UNIT_FAMILY_ALIASES.get(allowed_unit_family, frozenset({normalized_allowed}))
    return normalized_unit in aliases


def tag_priority(metric_key, tag):
    metric = get_metric_definition_or_none(metric_key)
    if not metric:
        return 10_000

    try:
        return metric.preferred_tags.index(tag)
    except ValueError:
        return len(metric.preferred_tags) + 1


def supports_period(metric_key, period_type):
    metric = get_metric_definition(metric_key)
    return period_type in metric.supported_periods


def _normalize_unit(unit):
    return str(unit or "").strip().lower().replace(" ", "")
