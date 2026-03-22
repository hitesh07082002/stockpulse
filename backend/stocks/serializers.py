from rest_framework import serializers
from .models import Company, FinancialFact, MetricSnapshot


class CompanyListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['ticker', 'name', 'sector', 'current_price', 'market_cap']


class CompanyDetailSerializer(serializers.ModelSerializer):
    pe_ratio = serializers.SerializerMethodField()
    dividend_yield = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'ticker', 'name', 'cik', 'exchange', 'sector', 'industry', 'description', 'website',
            'current_price', 'market_cap', 'week_52_high', 'week_52_low',
            'shares_outstanding', 'quote_updated_at',
            'pe_ratio', 'dividend_yield',
        ]

    def _snapshot(self, obj):
        try:
            return obj.metrics
        except MetricSnapshot.DoesNotExist:
            return None

    def get_pe_ratio(self, obj):
        snapshot = self._snapshot(obj)
        return snapshot.pe_ratio if snapshot else None

    def get_dividend_yield(self, obj):
        snapshot = self._snapshot(obj)
        return snapshot.dividend_yield if snapshot else None


class FinancialFactSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialFact
        fields = [
            'metric_key', 'period_type', 'fiscal_year', 'fiscal_quarter',
            'period_start', 'period_end', 'value', 'unit',
            'source_tag', 'source_form', 'filed_date',
            'is_amended', 'is_derived', 'selection_reason',
        ]


class MetricSnapshotSerializer(serializers.ModelSerializer):
    ticker = serializers.CharField(source='company.ticker')
    name = serializers.CharField(source='company.name')
    sector = serializers.CharField(source='company.sector')
    current_price = serializers.DecimalField(
        source='company.current_price', max_digits=12, decimal_places=2, allow_null=True
    )
    market_cap = serializers.IntegerField(source='company.market_cap', allow_null=True)

    class Meta:
        model = MetricSnapshot
        fields = [
            'ticker', 'name', 'sector', 'current_price', 'market_cap',
            'pe_ratio', 'dividend_yield', 'revenue_growth_yoy',
            'gross_margin', 'operating_margin', 'net_margin', 'roe', 'debt_to_equity',
            'free_cash_flow',
        ]


class DCFInputSerializer(serializers.Serializer):
    ticker = serializers.CharField()
    name = serializers.CharField()
    sector = serializers.CharField()
    current_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    shares_outstanding = serializers.IntegerField()
    free_cash_flow = serializers.DecimalField(max_digits=20, decimal_places=2, allow_null=True)
    sector_warning = serializers.CharField(allow_blank=True)
    negative_fcf_warning = serializers.BooleanField()


class ChatMessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000)
