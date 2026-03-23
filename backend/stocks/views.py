from rest_framework import generics, filters
from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .copilot import CopilotRequestError, build_copilot_response
from .models import Company, FinancialFact, MetricSnapshot
from .pricing import PriceCacheUnavailable, get_or_refresh_price_cache
from .serializers import (
    CompanyListSerializer, CompanyDetailSerializer,
    FinancialFactSerializer, MetricSnapshotSerializer,
)


def _safe_number(value):
    if value in (None, ''):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if number != number:
        return None
    return number


def _get_metric_snapshot(company):
    try:
        return company.metrics
    except MetricSnapshot.DoesNotExist:
        return None


def _latest_annual_fact(company, metric_key):
    return FinancialFact.objects.filter(
        company=company,
        metric_key=metric_key,
        period_type='annual',
    ).order_by('-fiscal_year').first()


def _is_financial_sector_company(company):
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


def _annual_growth_percentage(company, metric_key):
    facts = list(
        FinancialFact.objects.filter(
            company=company,
            metric_key=metric_key,
            period_type='annual',
        ).order_by('-fiscal_year')[:2]
    )
    if len(facts) < 2:
        return None

    latest = _safe_number(facts[0].value)
    previous = _safe_number(facts[1].value)
    if latest is None or previous in (None, 0):
        return None

    # Crossing zero produces unusable growth assumptions for a simple 5-year model.
    if latest <= 0 or previous <= 0:
        return None

    growth = ((latest - previous) / previous) * 100
    return round(growth, 1)


def _bounded_growth_default(value, default=10.0):
    if value is None:
        return default

    # Keep the prefilled assumption sober enough for a 5-year retail-facing DCF.
    return round(min(max(value, -10.0), 20.0), 1)


def _compute_revenue_growth_default(company, snapshot):
    if snapshot and snapshot.revenue_growth_yoy is not None:
        return round(float(snapshot.revenue_growth_yoy) * 100, 1)

    revenue_facts = list(
        FinancialFact.objects.filter(
            company=company,
            metric_key='revenue',
            period_type='annual',
        ).order_by('-fiscal_year')[:2]
    )
    if len(revenue_facts) < 2:
        return 10.0

    latest = _safe_number(revenue_facts[0].value)
    previous = _safe_number(revenue_facts[1].value)
    if latest is None or previous in (None, 0):
        return 10.0

    return round(((latest - previous) / abs(previous)) * 100, 1)


def _compute_earnings_growth_default(company, snapshot):
    eps_growth = _annual_growth_percentage(company, 'diluted_eps')
    if eps_growth is not None:
        return _bounded_growth_default(eps_growth)

    net_income_growth = _annual_growth_percentage(company, 'net_income')
    if net_income_growth is not None:
        return _bounded_growth_default(net_income_growth)

    return _bounded_growth_default(_compute_revenue_growth_default(company, snapshot))


def _compute_cash_flow_growth_default(company, snapshot):
    free_cash_flow_growth = _annual_growth_percentage(company, 'free_cash_flow')
    if free_cash_flow_growth is not None:
        return _bounded_growth_default(free_cash_flow_growth)

    operating_cash_flow_growth = _annual_growth_percentage(company, 'operating_cash_flow')
    if operating_cash_flow_growth is not None:
        return _bounded_growth_default(operating_cash_flow_growth)

    return _bounded_growth_default(_compute_revenue_growth_default(company, snapshot))


def _compute_eps_value(company, snapshot):
    diluted_eps_fact = _latest_annual_fact(company, 'diluted_eps')
    if diluted_eps_fact:
        return round(float(diluted_eps_fact.value), 2)

    current_price = _safe_number(company.current_price)
    pe_ratio = _safe_number(snapshot.pe_ratio) if snapshot else None
    if current_price not in (None, 0) and pe_ratio not in (None, 0):
        return round(current_price / pe_ratio, 2)

    net_income_fact = _latest_annual_fact(company, 'net_income')
    shares_outstanding = _safe_number(company.shares_outstanding)
    net_income = _safe_number(net_income_fact.value) if net_income_fact else None
    if net_income is None or shares_outstanding in (None, 0):
        return None

    return round(net_income / shares_outstanding, 2)


# --- Company endpoints ---

class CompanyListView(generics.ListAPIView):
    serializer_class = CompanyListSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ticker', 'name']
    ordering_fields = ['ticker', 'name', 'market_cap']
    ordering = ['ticker']

    def get_queryset(self):
        qs = Company.objects.all()
        sector = self.request.query_params.get('sector')
        if sector:
            qs = qs.filter(sector__iexact=sector)
        return qs


class CompanyDetailView(generics.RetrieveAPIView):
    serializer_class = CompanyDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = 'ticker'
    lookup_url_kwarg = 'ticker'

    def get_queryset(self):
        return Company.objects.select_related('metrics').all()

    def get_object(self):
        ticker = self.kwargs['ticker'].upper()
        return generics.get_object_or_404(Company, ticker=ticker)


# --- Financials endpoint ---

@api_view(['GET'])
def financials_view(request, ticker):
    ticker = ticker.upper()
    company = generics.get_object_or_404(Company, ticker=ticker)

    qs = FinancialFact.objects.filter(company=company)

    # Filter by metric(s)
    metrics = request.query_params.get('metrics')
    if metrics:
        metric_list = [m.strip() for m in metrics.split(',')]
        qs = qs.filter(metric_key__in=metric_list)

    # Filter by period type
    period_type = request.query_params.get('period_type')
    if period_type:
        qs = qs.filter(period_type=period_type)

    # Filter by year range
    start_year = request.query_params.get('start_year')
    if start_year:
        qs = qs.filter(fiscal_year__gte=int(start_year))

    end_year = request.query_params.get('end_year')
    if end_year:
        qs = qs.filter(fiscal_year__lte=int(end_year))

    ordered_facts = qs.order_by('fiscal_year', 'fiscal_quarter', 'metric_key')
    available_metrics = list(
        ordered_facts.order_by().values_list('metric_key', flat=True).distinct()
    )
    serializer = FinancialFactSerializer(ordered_facts, many=True)
    return Response({
        'ticker': company.ticker,
        'company_name': company.name,
        'period_type': period_type or None,
        'available_metrics': available_metrics,
        'facts': serializer.data,
    })


# --- Price endpoint (yfinance proxy with caching) ---

@api_view(['GET'])
def prices_view(request, ticker):
    ticker = ticker.upper()
    company = generics.get_object_or_404(Company, ticker=ticker)

    range_param = request.query_params.get('range', '1Y')
    try:
        payload = get_or_refresh_price_cache(company, range_param)
    except ValueError as exc:
        return Response({
            'message': str(exc),
        }, status=400)
    except PriceCacheUnavailable:
        return Response({
            'message': 'Price data unavailable. Retry.',
        }, status=503)

    if not payload['data']:
        payload['message'] = 'No price history available'

    return Response(payload)


# --- Valuation inputs endpoint ---

@api_view(['GET'])
def valuation_inputs_view(request, ticker):
    ticker = ticker.upper()
    company = generics.get_object_or_404(Company, ticker=ticker)
    snapshot = _get_metric_snapshot(company)

    free_cash_flow_fact = _latest_annual_fact(company, 'free_cash_flow')
    ocf = _latest_annual_fact(company, 'operating_cash_flow')
    capex = _latest_annual_fact(company, 'capital_expenditures')

    free_cash_flow = _safe_number(free_cash_flow_fact.value) if free_cash_flow_fact else None
    if free_cash_flow is None and ocf and capex:
        free_cash_flow = float(ocf.value) - float(capex.value)
    elif free_cash_flow is None and ocf:
        free_cash_flow = float(ocf.value)

    negative_cash_flow = free_cash_flow is not None and free_cash_flow < 0
    shares_outstanding = _safe_number(company.shares_outstanding)
    current_price = _safe_number(company.current_price)
    earnings_growth_rate_default = _compute_earnings_growth_default(company, snapshot)
    cash_flow_growth_rate_default = _compute_cash_flow_growth_default(company, snapshot)
    financial_sector_company = _is_financial_sector_company(company)

    earnings_metric_value = _compute_eps_value(company, snapshot)
    negative_earnings = earnings_metric_value is not None and earnings_metric_value < 0
    earnings_multiple = _safe_number(snapshot.pe_ratio) if snapshot else None
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

    data = {
        'ticker': company.ticker,
        'name': company.name,
        'sector': company.sector,
        'industry': company.industry,
        'current_price': company.current_price,
        'shares_outstanding': company.shares_outstanding,
        'projection_years_default': 5,
        'not_applicable': False,
        'not_applicable_reason': None,
        'guardrails': {
            'financial_sector_caution': financial_sector_company,
            'negative_earnings': negative_earnings,
            'negative_free_cash_flow': negative_cash_flow,
            'missing_shares_outstanding': shares_outstanding in (None, 0),
        },
        'warnings': warnings,
        'earnings_mode': {
            'available': earnings_mode_available,
            'availability_reason': (
                "Missing trailing EPS input."
                if earnings_metric_value is None
                else None
            ),
            'warnings': earnings_warnings,
            'current_metric_label': 'EPS',
            'current_metric_value': earnings_metric_value,
            'growth_rate_default': earnings_growth_rate_default,
            'terminal_multiple_default': earnings_multiple,
            'desired_return_default': 15.0,
            'current_trading_multiple': _safe_number(snapshot.pe_ratio) if snapshot else None,
        },
        'cash_flow_mode': {
            'available': cash_flow_mode_available,
            'availability_reason': (
                "Missing shares outstanding for per-share cash flow valuation."
                if shares_outstanding in (None, 0)
                else "Missing trailing free cash flow input."
                if cash_flow_metric_value is None
                else None
            ),
            'warnings': cash_flow_warnings,
            'current_metric_label': 'FCF Per Share',
            'current_metric_value': cash_flow_metric_value,
            'growth_rate_default': cash_flow_growth_rate_default,
            'terminal_multiple_default': cash_flow_multiple,
            'desired_return_default': 15.0,
            'current_trading_multiple': cash_flow_multiple if cash_flow_metric_value not in (None, 0) else None,
        },
    }

    return Response(data)


# --- Screener endpoint ---

class ScreenerView(generics.ListAPIView):
    serializer_class = MetricSnapshotSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = MetricSnapshot.objects.select_related('company').all()

        params = self.request.query_params

        # Sector filter
        sector = params.get('sector')
        if sector:
            qs = qs.filter(company__sector__iexact=sector)

        industry = params.get('industry')
        if industry:
            qs = qs.filter(company__industry__icontains=industry)

        # Range filters
        range_filters = {
            'pe_min': ('pe_ratio__gte', float),
            'pe_max': ('pe_ratio__lte', float),
            'market_cap_min': ('company__market_cap__gte', int),
            'market_cap_max': ('company__market_cap__lte', int),
            'revenue_growth_min': ('revenue_growth_yoy__gte', float),
            'revenue_growth_max': ('revenue_growth_yoy__lte', float),
            'gross_margin_min': ('gross_margin__gte', float),
            'gross_margin_max': ('gross_margin__lte', float),
            'operating_margin_min': ('operating_margin__gte', float),
            'operating_margin_max': ('operating_margin__lte', float),
            'debt_to_equity_min': ('debt_to_equity__gte', float),
            'debt_to_equity_max': ('debt_to_equity__lte', float),
        }

        for param_name, (field_lookup, cast_fn) in range_filters.items():
            val = params.get(param_name)
            if val is not None:
                try:
                    qs = qs.filter(**{field_lookup: cast_fn(val)})
                except (ValueError, TypeError):
                    pass

        positive_fcf = params.get('positive_fcf', params.get('positive_free_cash_flow'))
        if str(positive_fcf).lower() in {'1', 'true', 'yes', 'on'}:
            qs = qs.filter(free_cash_flow__gt=0)

        # Sorting
        sort_field = params.get('sort', 'market_cap')
        order = params.get('order', 'desc')
        allowed_sorts = {
            'market_cap': 'company__market_cap',
            'current_price': 'company__current_price',
            'pe_ratio': 'pe_ratio',
            'industry': 'company__industry',
            'revenue_growth_yoy': 'revenue_growth_yoy',
            'gross_margin': 'gross_margin',
            'operating_margin': 'operating_margin',
            'debt_to_equity': 'debt_to_equity',
            'free_cash_flow': 'free_cash_flow',
            'ticker': 'company__ticker',
            'name': 'company__name',
            'sector': 'company__sector',
        }
        db_field = allowed_sorts.get(sort_field, 'company__market_cap')
        if order == 'asc':
            qs = qs.order_by(db_field)
        else:
            qs = qs.order_by(f'-{db_field}')

        return qs

@api_view(['POST'])
def chat_view(request, ticker):
    try:
        return build_copilot_response(request, ticker)
    except CopilotRequestError as exc:
        return exc.to_response()
