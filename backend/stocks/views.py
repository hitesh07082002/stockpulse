import json
import time
from decimal import Decimal
from datetime import date

from django.conf import settings
from django.http import StreamingHttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from rest_framework import generics, filters, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .models import Company, FinancialFact, StockMetrics
from .serializers import (
    CompanyListSerializer, CompanyDetailSerializer,
    FinancialFactSerializer, StockMetricsSerializer,
    DCFInputSerializer, ChatMessageSerializer,
)
from .xbrl_mapping import DCF_WARNING_SECTORS


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
        return Company.objects.all()

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
    metrics = request.query_params.get('metric')
    if metrics:
        metric_list = [m.strip() for m in metrics.split(',')]
        qs = qs.filter(metric__in=metric_list)

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

    serializer = FinancialFactSerializer(qs.order_by('fiscal_year', 'fiscal_quarter'), many=True)
    return Response(serializer.data)


# --- Price endpoint (yfinance proxy with caching) ---

@api_view(['GET'])
def prices_view(request, ticker):
    ticker = ticker.upper()
    company = generics.get_object_or_404(Company, ticker=ticker)

    range_param = request.query_params.get('range', '1Y')
    valid_ranges = {'1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '5Y': '5y', 'MAX': 'max'}
    yf_period = valid_ranges.get(range_param, '1y')

    # Determine cache TTL based on range
    cache_ttl_hours = 4 if range_param in ('1M', '3M', '6M', '1Y') else 24

    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        hist = stock.history(period=yf_period)

        if hist.empty:
            return Response({
                'ticker': ticker,
                'data': [],
                'stale': True,
                'message': 'No price data available',
            })

        data = []
        for idx, row in hist.iterrows():
            data.append({
                'date': idx.strftime('%Y-%m-%d'),
                'open': round(float(row['Open']), 2),
                'high': round(float(row['High']), 2),
                'low': round(float(row['Low']), 2),
                'close': round(float(row['Close']), 2),
                'volume': int(row['Volume']),
            })

        return Response({
            'ticker': ticker,
            'data': data,
            'stale': False,
            'updated_at': timezone.now().isoformat(),
        })

    except Exception:
        # Serve stale data indicator
        return Response({
            'ticker': ticker,
            'data': [],
            'stale': True,
            'message': 'Price data temporarily unavailable',
            'price_updated_at': company.price_updated_at.isoformat() if company.price_updated_at else None,
        })


# --- DCF inputs endpoint ---

@api_view(['GET'])
def dcf_inputs_view(request, ticker):
    ticker = ticker.upper()
    company = generics.get_object_or_404(Company, ticker=ticker)

    # Get latest operating cash flow and capex to compute FCF
    ocf = FinancialFact.objects.filter(
        company=company, metric='operating_cash_flow', period_type='annual'
    ).order_by('-fiscal_year').first()

    capex = FinancialFact.objects.filter(
        company=company, metric='capital_expenditures', period_type='annual'
    ).order_by('-fiscal_year').first()

    fcf = None
    negative_fcf = False
    if ocf and capex:
        fcf = float(ocf.value) - float(capex.value)
        negative_fcf = fcf < 0
    elif ocf:
        fcf = float(ocf.value)
        negative_fcf = fcf < 0

    sector_warning = ''
    if company.sector in DCF_WARNING_SECTORS:
        sector_warning = (
            f"DCF models are less reliable for {company.sector} companies. "
            "Consider using P/E or P/B multiples instead."
        )

    data = {
        'ticker': company.ticker,
        'name': company.name,
        'sector': company.sector,
        'current_price': company.current_price,
        'shares_outstanding': company.shares_outstanding,
        'free_cash_flow': fcf,
        'sector_warning': sector_warning,
        'negative_fcf_warning': negative_fcf,
    }

    return Response(data)


# --- Screener endpoint ---

class ScreenerView(generics.ListAPIView):
    serializer_class = StockMetricsSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = StockMetrics.objects.select_related('company').all()

        params = self.request.query_params

        # Sector filter
        sector = params.get('sector')
        if sector:
            qs = qs.filter(company__sector__iexact=sector)

        # Range filters
        range_filters = {
            'pe_min': ('pe_ratio__gte', float),
            'pe_max': ('pe_ratio__lte', float),
            'dividend_min': ('dividend_yield__gte', float),
            'dividend_max': ('dividend_yield__lte', float),
            'margin_min': ('profit_margin__gte', float),
            'margin_max': ('profit_margin__lte', float),
            'roe_min': ('roe__gte', float),
            'roe_max': ('roe__lte', float),
            'de_min': ('debt_to_equity__gte', float),
            'de_max': ('debt_to_equity__lte', float),
            'mcap_min': ('company__market_cap__gte', int),
            'mcap_max': ('company__market_cap__lte', int),
            'growth_min': ('revenue_growth_yoy__gte', float),
            'growth_max': ('revenue_growth_yoy__lte', float),
        }

        for param_name, (field_lookup, cast_fn) in range_filters.items():
            val = params.get(param_name)
            if val is not None:
                try:
                    qs = qs.filter(**{field_lookup: cast_fn(val)})
                except (ValueError, TypeError):
                    pass

        # Sorting
        sort_field = params.get('sort', 'company__market_cap')
        order = params.get('order', 'desc')
        allowed_sorts = {
            'market_cap': 'company__market_cap',
            'pe_ratio': 'pe_ratio',
            'dividend_yield': 'dividend_yield',
            'profit_margin': 'profit_margin',
            'roe': 'roe',
            'revenue_growth': 'revenue_growth_yoy',
            'ticker': 'company__ticker',
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
    ).order_by('metric', 'fiscal_year')

    # Last 8 quarters
    quarterly_facts = FinancialFact.objects.filter(
        company=company,
        period_type='quarterly',
    ).order_by('metric', '-fiscal_year', '-fiscal_quarter')[:200]

    # Group by metric
    annual_by_metric = {}
    for fact in annual_facts:
        annual_by_metric.setdefault(fact.metric, []).append(
            f"  {fact.fiscal_year}: {fact.value:,.0f}"
        )

    quarterly_by_metric = {}
    for fact in quarterly_facts:
        quarterly_by_metric.setdefault(fact.metric, []).append(
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
            f"Profit Margin: {float(metrics.profit_margin)*100:.1f}%" if metrics.profit_margin else "",
            f"ROE: {float(metrics.roe)*100:.1f}%" if metrics.roe else "",
            f"Debt/Equity: {metrics.debt_to_equity}" if metrics.debt_to_equity else "",
            f"Dividend Yield: {float(metrics.dividend_yield)*100:.2f}%" if metrics.dividend_yield else "",
            f"Revenue Growth YoY: {float(metrics.revenue_growth_yoy)*100:.1f}%" if metrics.revenue_growth_yoy else "",
        ])
    except StockMetrics.DoesNotExist:
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
