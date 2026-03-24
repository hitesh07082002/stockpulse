from .models import FinancialFact, MetricSnapshot


def safe_number(value):
    if value in (None, ""):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if number != number:
        return None
    return number


def get_metric_snapshot(company):
    try:
        return company.metrics
    except MetricSnapshot.DoesNotExist:
        return None


def latest_annual_fact(company, metric_key):
    return (
        FinancialFact.objects.filter(
            company=company,
            metric_key=metric_key,
            period_type=FinancialFact.PERIOD_ANNUAL,
        )
        .order_by("-fiscal_year")
        .first()
    )


def is_financial_sector_company(company):
    sector = (company.sector or "").strip().lower()
    industry = (company.industry or "").strip().lower()

    if sector in {"financial services", "financials"}:
        return True

    industry_keywords = (
        "bank",
        "insurance",
        "exchange",
        "capital market",
        "brokerage",
        "asset management",
    )
    return any(keyword in industry for keyword in industry_keywords)


def annual_growth_percentage(company, metric_key):
    facts = list(
        FinancialFact.objects.filter(
            company=company,
            metric_key=metric_key,
            period_type=FinancialFact.PERIOD_ANNUAL,
        ).order_by("-fiscal_year")[:2]
    )
    if len(facts) < 2:
        return None

    latest = safe_number(facts[0].value)
    previous = safe_number(facts[1].value)
    if latest is None or previous in (None, 0):
        return None

    if latest <= 0 or previous <= 0:
        return None

    growth = ((latest - previous) / previous) * 100
    return round(growth, 1)


def bounded_growth_default(value, default=10.0):
    if value is None:
        return default
    return round(min(max(value, -10.0), 20.0), 1)


def compute_revenue_growth_default(company, snapshot):
    if snapshot and snapshot.revenue_growth_yoy is not None:
        return round(float(snapshot.revenue_growth_yoy) * 100, 1)

    revenue_facts = list(
        FinancialFact.objects.filter(
            company=company,
            metric_key="revenue",
            period_type=FinancialFact.PERIOD_ANNUAL,
        ).order_by("-fiscal_year")[:2]
    )
    if len(revenue_facts) < 2:
        return 10.0

    latest = safe_number(revenue_facts[0].value)
    previous = safe_number(revenue_facts[1].value)
    if latest is None or previous in (None, 0):
        return 10.0

    return round(((latest - previous) / abs(previous)) * 100, 1)


def compute_earnings_growth_default(company, snapshot):
    eps_growth = annual_growth_percentage(company, "diluted_eps")
    if eps_growth is not None:
        return bounded_growth_default(eps_growth)

    net_income_growth = annual_growth_percentage(company, "net_income")
    if net_income_growth is not None:
        return bounded_growth_default(net_income_growth)

    return bounded_growth_default(compute_revenue_growth_default(company, snapshot))


def compute_cash_flow_growth_default(company, snapshot):
    free_cash_flow_growth = annual_growth_percentage(company, "free_cash_flow")
    if free_cash_flow_growth is not None:
        return bounded_growth_default(free_cash_flow_growth)

    operating_cash_flow_growth = annual_growth_percentage(company, "operating_cash_flow")
    if operating_cash_flow_growth is not None:
        return bounded_growth_default(operating_cash_flow_growth)

    return bounded_growth_default(compute_revenue_growth_default(company, snapshot))


def compute_eps_value(company, snapshot):
    diluted_eps_fact = latest_annual_fact(company, "diluted_eps")
    if diluted_eps_fact:
        return round(float(diluted_eps_fact.value), 2)

    current_price = safe_number(company.current_price)
    pe_ratio = safe_number(snapshot.pe_ratio) if snapshot else None
    if current_price not in (None, 0) and pe_ratio not in (None, 0):
        return round(current_price / pe_ratio, 2)

    net_income_fact = latest_annual_fact(company, "net_income")
    shares_outstanding = safe_number(company.shares_outstanding)
    net_income = safe_number(net_income_fact.value) if net_income_fact else None
    if net_income is None or shares_outstanding in (None, 0):
        return None

    return round(net_income / shares_outstanding, 2)


def build_valuation_inputs_payload(company):
    snapshot = get_metric_snapshot(company)

    free_cash_flow_fact = latest_annual_fact(company, "free_cash_flow")
    operating_cash_flow_fact = latest_annual_fact(company, "operating_cash_flow")
    capital_expenditures_fact = latest_annual_fact(company, "capital_expenditures")

    free_cash_flow = (
        safe_number(free_cash_flow_fact.value)
        if free_cash_flow_fact
        else None
    )
    if free_cash_flow is None and operating_cash_flow_fact and capital_expenditures_fact:
        free_cash_flow = float(operating_cash_flow_fact.value) - float(capital_expenditures_fact.value)
    elif free_cash_flow is None and operating_cash_flow_fact:
        free_cash_flow = float(operating_cash_flow_fact.value)

    negative_cash_flow = free_cash_flow is not None and free_cash_flow < 0
    shares_outstanding = safe_number(company.shares_outstanding)
    current_price = safe_number(company.current_price)
    earnings_growth_rate_default = compute_earnings_growth_default(company, snapshot)
    cash_flow_growth_rate_default = compute_cash_flow_growth_default(company, snapshot)
    financial_sector_company = is_financial_sector_company(company)

    earnings_metric_value = compute_eps_value(company, snapshot)
    negative_earnings = earnings_metric_value is not None and earnings_metric_value < 0
    earnings_multiple = safe_number(snapshot.pe_ratio) if snapshot else None
    if earnings_multiple in (None, 0):
        earnings_multiple = 18.0

    cash_flow_metric_value = None
    cash_flow_multiple = None
    if free_cash_flow is not None and shares_outstanding not in (None, 0):
        cash_flow_metric_value = round(free_cash_flow / shares_outstanding, 2)
        if current_price not in (None, 0) and cash_flow_metric_value not in (None, 0):
            cash_flow_multiple = round(current_price / cash_flow_metric_value, 2)

    if cash_flow_multiple in (None, 0):
        cash_flow_multiple = 15.0

    warnings = []
    earnings_warnings = []
    cash_flow_warnings = []
    if negative_earnings:
        earnings_warnings.append(
            "Trailing earnings are negative, so earnings-based valuation needs extra caution."
        )
    if financial_sector_company:
        cash_flow_warnings.append(
            "Financial companies fit a simplified cash-flow DCF less cleanly, so use this output as a rough framing tool."
        )
    if negative_cash_flow:
        cash_flow_warnings.append(
            "Free cash flow is currently negative, so cash-flow-based valuation should be used with caution."
        )
    if shares_outstanding in (None, 0):
        cash_flow_warnings.append(
            "Cash Flow mode requires shares outstanding before per-share valuation can be shown."
        )

    earnings_mode_available = earnings_metric_value is not None
    cash_flow_mode_available = (
        cash_flow_metric_value is not None
        and shares_outstanding not in (None, 0)
    )

    return {
        "ticker": company.ticker,
        "name": company.name,
        "sector": company.sector,
        "industry": company.industry,
        "current_price": company.current_price,
        "shares_outstanding": company.shares_outstanding,
        "projection_years_default": 5,
        "not_applicable": False,
        "not_applicable_reason": None,
        "guardrails": {
            "financial_sector_caution": financial_sector_company,
            "negative_earnings": negative_earnings,
            "negative_free_cash_flow": negative_cash_flow,
            "missing_shares_outstanding": shares_outstanding in (None, 0),
        },
        "warnings": warnings,
        "earnings_mode": {
            "available": earnings_mode_available,
            "availability_reason": (
                "Missing trailing EPS input."
                if earnings_metric_value is None
                else None
            ),
            "warnings": earnings_warnings,
            "current_metric_label": "EPS",
            "current_metric_value": earnings_metric_value,
            "growth_rate_default": earnings_growth_rate_default,
            "terminal_multiple_default": earnings_multiple,
            "desired_return_default": 15.0,
            "current_trading_multiple": safe_number(snapshot.pe_ratio) if snapshot else None,
        },
        "cash_flow_mode": {
            "available": cash_flow_mode_available,
            "availability_reason": (
                "Missing shares outstanding for per-share cash flow valuation."
                if shares_outstanding in (None, 0)
                else "Missing trailing free cash flow input."
                if cash_flow_metric_value is None
                else None
            ),
            "warnings": cash_flow_warnings,
            "current_metric_label": "FCF Per Share",
            "current_metric_value": cash_flow_metric_value,
            "growth_rate_default": cash_flow_growth_rate_default,
            "terminal_multiple_default": cash_flow_multiple,
            "desired_return_default": 15.0,
            "current_trading_multiple": (
                cash_flow_multiple
                if cash_flow_metric_value not in (None, 0)
                else None
            ),
        },
    }
