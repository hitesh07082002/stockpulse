from rest_framework import serializers
from .models import Company, FinancialFact, StockMetrics


class CompanyListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['ticker', 'name', 'sector', 'current_price', 'market_cap']


class CompanyDetailSerializer(serializers.ModelSerializer):
    pe_ratio = serializers.DecimalField(
        source='metrics.pe_ratio', max_digits=10, decimal_places=2,
        read_only=True, allow_null=True, default=None,
    )
    dividend_yield = serializers.DecimalField(
        source='metrics.dividend_yield', max_digits=6, decimal_places=4,
        read_only=True, allow_null=True, default=None,
    )

    class Meta:
        model = Company
        fields = [
            'ticker', 'name', 'cik', 'sector', 'industry', 'description',
            'current_price', 'market_cap', 'week_52_high', 'week_52_low',
            'shares_outstanding', 'price_updated_at',
            'pe_ratio', 'dividend_yield',
        ]


class FinancialFactSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialFact
        fields = ['metric', 'period_type', 'fiscal_year', 'fiscal_quarter',
                  'period_end_date', 'value', 'unit']


class StockMetricsSerializer(serializers.ModelSerializer):
    ticker = serializers.CharField(source='company.ticker')
    name = serializers.CharField(source='company.name')
    sector = serializers.CharField(source='company.sector')
    current_price = serializers.DecimalField(
        source='company.current_price', max_digits=12, decimal_places=2
    )
    market_cap = serializers.IntegerField(source='company.market_cap')

    class Meta:
        model = StockMetrics
        fields = [
            'ticker', 'name', 'sector', 'current_price', 'market_cap',
            'pe_ratio', 'dividend_yield', 'revenue_growth_yoy', 'profit_margin',
            'gross_margin', 'operating_margin', 'roe', 'debt_to_equity',
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
