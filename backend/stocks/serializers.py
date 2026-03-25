from django.conf import settings
from rest_framework import serializers
from .models import Company, FinancialFact, MetricSnapshot


class CompanyListSerializer(serializers.ModelSerializer):
    quote_updated_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Company
        fields = [
            'ticker',
            'name',
            'sector',
            'industry',
            'current_price',
            'market_cap',
            'quote_updated_at',
        ]


class CompanyDetailSerializer(serializers.ModelSerializer):
    pe_ratio = serializers.SerializerMethodField()
    dividend_yield = serializers.SerializerMethodField()
    revenue_growth_yoy = serializers.SerializerMethodField()
    operating_margin = serializers.SerializerMethodField()
    net_margin = serializers.SerializerMethodField()
    roe = serializers.SerializerMethodField()
    free_cash_flow = serializers.SerializerMethodField()
    latest_revenue = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'ticker', 'name', 'cik', 'exchange', 'sector', 'industry', 'description', 'website',
            'current_price', 'market_cap', 'week_52_high', 'week_52_low',
            'shares_outstanding', 'quote_updated_at', 'facts_updated_at',
            'pe_ratio', 'dividend_yield', 'revenue_growth_yoy',
            'operating_margin', 'net_margin', 'roe', 'free_cash_flow', 'latest_revenue',
        ]

    def _snapshot(self, obj):
        try:
            return obj.metrics
        except MetricSnapshot.DoesNotExist:
            return None

    def _snapshot_value(self, obj, field_name):
        snapshot = self._snapshot(obj)
        value = getattr(snapshot, field_name, None) if snapshot else None
        return float(value) if value is not None else None

    def _latest_annual_fact_value(self, obj, metric_key):
        fact = obj.financial_facts.filter(
            metric_key=metric_key,
            period_type=FinancialFact.PERIOD_ANNUAL,
        ).order_by('-fiscal_year', '-period_end').first()
        return float(fact.value) if fact else None

    def get_pe_ratio(self, obj):
        snapshot = self._snapshot(obj)
        return snapshot.pe_ratio if snapshot else None

    def get_dividend_yield(self, obj):
        snapshot = self._snapshot(obj)
        return snapshot.dividend_yield if snapshot else None

    def get_revenue_growth_yoy(self, obj):
        return self._snapshot_value(obj, 'revenue_growth_yoy')

    def get_operating_margin(self, obj):
        return self._snapshot_value(obj, 'operating_margin')

    def get_net_margin(self, obj):
        return self._snapshot_value(obj, 'net_margin')

    def get_roe(self, obj):
        return self._snapshot_value(obj, 'roe')

    def get_free_cash_flow(self, obj):
        return self._snapshot_value(obj, 'free_cash_flow')

    def get_latest_revenue(self, obj):
        return self._latest_annual_fact_value(obj, 'revenue')


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
    industry = serializers.CharField(source='company.industry')
    current_price = serializers.DecimalField(
        source='company.current_price', max_digits=12, decimal_places=2, allow_null=True
    )
    market_cap = serializers.IntegerField(source='company.market_cap', allow_null=True)

    class Meta:
        model = MetricSnapshot
        fields = [
            'ticker', 'name', 'sector', 'industry', 'current_price', 'market_cap',
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
    class HistoryTurnSerializer(serializers.Serializer):
        role = serializers.ChoiceField(choices=["user", "assistant", "ai"])
        content = serializers.CharField(max_length=4000, trim_whitespace=True)

        def validate_role(self, value):
            return "assistant" if value == "ai" else value

        def validate_content(self, value):
            content = value.strip()
            if not content:
                raise serializers.ValidationError("History content cannot be blank.")
            return content

    message = serializers.CharField(max_length=1000, trim_whitespace=True)
    history = HistoryTurnSerializer(many=True, required=False, allow_empty=True)

    def validate_message(self, value):
        message = value.strip()
        if not message:
            raise serializers.ValidationError("Message is required.")
        return message

    def validate_history(self, value):
        max_turns = getattr(settings, "AI_MAX_HISTORY_TURNS", 6)
        max_messages = max_turns * 2
        if len(value) > max_messages:
            raise serializers.ValidationError(
                f"History is limited to the most recent {max_turns} turns."
            )
        return value
