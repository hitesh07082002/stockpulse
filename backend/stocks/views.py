import json
from datetime import date

from django.conf import settings
from django.http import StreamingHttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from rest_framework import generics, filters
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

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
    financial_sector_disabled = _is_financial_sector_company(company)

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
    if financial_sector_disabled:
        warnings.append(
            "Valuation is not applicable for financial sector companies in V1."
        )
    if negative_earnings:
        warnings.append(
            "Trailing earnings are negative, so earnings-based valuation needs extra caution."
        )
    if negative_cash_flow:
        warnings.append(
            "Free cash flow is currently negative, so cash-flow-based valuation should be used with caution."
        )
    if shares_outstanding in (None, 0):
        warnings.append(
            "Cash Flow mode requires shares outstanding before per-share valuation can be shown."
        )

    not_applicable_reason = (
        "Not applicable for financial sector companies."
        if financial_sector_disabled
        else None
    )
    earnings_mode_available = not financial_sector_disabled and earnings_metric_value is not None
    cash_flow_mode_available = (
        not financial_sector_disabled
        and cash_flow_metric_value is not None
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
        'not_applicable': financial_sector_disabled,
        'not_applicable_reason': not_applicable_reason,
        'guardrails': {
            'financial_sector_disabled': financial_sector_disabled,
            'negative_earnings': negative_earnings,
            'negative_free_cash_flow': negative_cash_flow,
            'missing_shares_outstanding': shares_outstanding in (None, 0),
        },
        'warnings': warnings,
        'earnings_mode': {
            'available': earnings_mode_available,
            'availability_reason': (
                not_applicable_reason
                if financial_sector_disabled
                else f"Missing trailing {('EPS')} input."
                if earnings_metric_value is None
                else None
            ),
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
                not_applicable_reason
                if financial_sector_disabled
                else "Missing shares outstanding for per-share cash flow valuation."
                if shares_outstanding in (None, 0)
                else "Missing trailing free cash flow input."
                if cash_flow_metric_value is None
                else None
            ),
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


# --- AI Chat endpoint ---

def _get_ai_rate_limit_key(request):
    """Get rate limit identifier — user ID if authenticated, IP otherwise."""
    if request.user and request.user.is_authenticated:
        return f"user:{request.user.id}"
    ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
    if ',' in ip:
        ip = ip.split(',')[0].strip()
    return f"ip:{ip}"


def _check_daily_limit(key):
    """Check if daily AI query limit is reached. Returns (allowed, count, limit)."""
    from django.core.cache import cache

    today = date.today().isoformat()
    cache_key = f"ai_queries:{today}:{key}"
    count = cache.get(cache_key, 0)

    is_user = key.startswith("user:")
    limit = settings.AI_DAILY_LIMIT_AUTHENTICATED if is_user else settings.AI_DAILY_LIMIT_ANONYMOUS

    if count >= limit:
        return False, count, limit
    return True, count, limit


def _increment_daily_count(key):
    from django.core.cache import cache

    today = date.today().isoformat()
    cache_key = f"ai_queries:{today}:{key}"
    count = cache.get(cache_key, 0)
    cache.set(cache_key, count + 1, timeout=86400)


def _build_financial_context(company):
    """Build structured financial data context for AI prompt."""
    current_year = date.today().year

    # Last 10 years annual data
    annual_facts = FinancialFact.objects.filter(
        company=company,
        period_type='annual',
        fiscal_year__gte=current_year - 10,
    ).order_by('metric_key', 'fiscal_year')

    # Last 8 quarters
    quarterly_facts = FinancialFact.objects.filter(
        company=company,
        period_type='quarterly',
    ).order_by('metric_key', '-fiscal_year', '-fiscal_quarter')[:200]

    # Group by metric
    annual_by_metric = {}
    for fact in annual_facts:
        annual_by_metric.setdefault(fact.metric_key, []).append(
            f"  {fact.fiscal_year}: {fact.value:,.0f}"
        )

    quarterly_by_metric = {}
    for fact in quarterly_facts:
        quarterly_by_metric.setdefault(fact.metric_key, []).append(
            f"  {fact.fiscal_year} Q{fact.fiscal_quarter or '?'}: {fact.value:,.0f}"
        )

    lines = [
        f"Company: {company.name} ({company.ticker})",
        f"Sector: {company.sector}",
        f"Industry: {company.industry}",
        f"Current Price: ${company.current_price}" if company.current_price else "",
        f"Market Cap: ${company.market_cap:,}" if company.market_cap else "",
        "",
        "=== Annual Financial Data (last 10 years, USD) ===",
    ]

    for metric, values in sorted(annual_by_metric.items()):
        lines.append(f"\n{metric.replace('_', ' ').title()}:")
        lines.extend(values)

    lines.append("\n=== Recent Quarterly Data (USD) ===")
    for metric, values in sorted(quarterly_by_metric.items()):
        lines.append(f"\n{metric.replace('_', ' ').title()}:")
        lines.extend(values[:8])  # Last 8 quarters

    # Add pre-computed metrics
    try:
        metrics = company.metrics
        lines.extend([
            "\n=== Current Metrics ===",
            f"P/E Ratio: {metrics.pe_ratio}" if metrics.pe_ratio else "",
            f"Net Margin: {float(metrics.net_margin)*100:.1f}%" if metrics.net_margin else "",
            f"ROE: {float(metrics.roe)*100:.1f}%" if metrics.roe else "",
            f"Debt/Equity: {metrics.debt_to_equity}" if metrics.debt_to_equity else "",
            f"Dividend Yield: {float(metrics.dividend_yield)*100:.2f}%" if metrics.dividend_yield else "",
            f"Revenue Growth YoY: {float(metrics.revenue_growth_yoy)*100:.1f}%" if metrics.revenue_growth_yoy else "",
        ])
    except MetricSnapshot.DoesNotExist:
        pass

    return "\n".join(line for line in lines if line)


@csrf_exempt
def chat_view(request, ticker):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    message = body.get('message', '').strip()
    if not message:
        return JsonResponse({'error': 'Message is required'}, status=400)

    if len(message) > 1000:
        return JsonResponse({'error': 'Message too long (max 1000 characters)'}, status=400)

    ticker = ticker.upper()
    try:
        company = Company.objects.get(ticker=ticker)
    except Company.DoesNotExist:
        return JsonResponse({'error': f'Company {ticker} not found'}, status=404)

    # Rate limiting
    rate_key = _get_ai_rate_limit_key(request)
    allowed, count, limit = _check_daily_limit(rate_key)

    if not allowed:
        is_anonymous = rate_key.startswith("ip:")
        if is_anonymous:
            return JsonResponse({
                'error': 'Daily limit reached',
                'message': f'You\'ve used {limit}/{limit} free queries today. Sign in for {settings.AI_DAILY_LIMIT_AUTHENTICATED} more.',
                'limit': limit,
                'used': count,
            }, status=429)
        else:
            return JsonResponse({
                'error': 'Daily limit reached',
                'message': f'You\'ve used {limit}/{limit} queries today. Limit resets at midnight UTC.',
                'limit': limit,
                'used': count,
            }, status=429)

    if not settings.ANTHROPIC_API_KEY:
        return JsonResponse({
            'error': 'AI service not configured',
            'message': 'The AI copilot is not available. Please configure the ANTHROPIC_API_KEY.',
        }, status=503)

    # Build context
    financial_context = _build_financial_context(company)

    system_prompt = (
        "You are a financial analyst assistant for StockPulse, an AI-powered stock analysis platform. "
        "You analyze the structured financial data provided below and answer questions about the company. "
        "Always cite specific numbers from the data. Be precise and quantitative. "
        "You are interpreting numerical trends from normalized SEC filing data — not quoting filing text directly. "
        "If the data doesn't contain enough information to answer, say so honestly. "
        "Keep responses concise but thorough. Use bullet points for comparisons. "
        "Format currency values with appropriate units (millions, billions).\n\n"
        f"--- FINANCIAL DATA ---\n{financial_context}\n--- END DATA ---"
    )

    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    def generate():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=settings.AI_MAX_TOKENS,
                system=system_prompt,
                messages=[{"role": "user", "content": message}],
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"

            _increment_daily_count(rate_key)
            yield f"data: {json.dumps({'type': 'done', 'used': count + 1, 'limit': limit})}\n\n"

        except anthropic.APIError as e:
            yield f"data: {json.dumps({'type': 'error', 'content': 'AI service temporarily unavailable. Please try again.'})}\n\n"

    response = StreamingHttpResponse(generate(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
