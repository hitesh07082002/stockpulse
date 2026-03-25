from rest_framework import generics, filters
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .copilot import CopilotRequestError, build_copilot_response
from .health import evaluate_health
from .models import Company, FinancialFact
from .pricing import PriceCacheUnavailable, get_or_refresh_price_cache
from .screener import build_screener_queryset
from .serializers import (
    CompanyListSerializer, CompanyDetailSerializer,
    FinancialFactSerializer, MetricSnapshotSerializer,
)
from .valuation_inputs import build_valuation_inputs_payload


@api_view(['GET'])
@permission_classes([AllowAny])
def health_view(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        payload, status_code = evaluate_health(db_ok=False, db_vendor=None)
        return Response(payload, status=status_code)

    payload, status_code = evaluate_health(
        db_ok=True,
        db_vendor=connection.vendor,
    )
    return Response(payload, status=status_code)


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
    return Response(build_valuation_inputs_payload(company))


# --- Screener endpoint ---

class ScreenerView(generics.ListAPIView):
    serializer_class = MetricSnapshotSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return build_screener_queryset(self.request.query_params)

@api_view(['POST'])
def chat_view(request, ticker):
    try:
        return build_copilot_response(request, ticker)
    except CopilotRequestError as exc:
        return exc.to_response()
