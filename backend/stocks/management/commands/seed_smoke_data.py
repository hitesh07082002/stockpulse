from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from stocks.models import Company, FinancialFact, MetricSnapshot, PriceCache


COMPANY_TICKER = "AAPL"
COMPANY_CIK = "0000320193"

COMPANY_DEFAULTS = {
    "ticker": COMPANY_TICKER,
    "cik": COMPANY_CIK,
    "name": "Apple Inc.",
    "exchange": "NASDAQ",
    "sector": "Information Technology",
    "industry": "Consumer Electronics",
    "description": "Apple designs consumer hardware, software, and services.",
    "website": "https://www.apple.com",
    "current_price": Decimal("195.25"),
    "market_cap": 2_930_000_000_000,
    "week_52_high": Decimal("199.62"),
    "week_52_low": Decimal("164.08"),
    "shares_outstanding": 15_050_000_000,
}

SNAPSHOT_DEFAULTS = {
    "pe_ratio": Decimal("28.90"),
    "dividend_yield": Decimal("0.0048"),
    "revenue_growth_yoy": Decimal("0.0200"),
    "gross_margin": Decimal("0.4620"),
    "operating_margin": Decimal("0.3130"),
    "net_margin": Decimal("0.2580"),
    "roe": Decimal("1.5200"),
    "debt_to_equity": Decimal("1.7500"),
    "free_cash_flow": Decimal("108807000000.00"),
}

ANNUAL_FACTS = [
    {
        "metric_key": "revenue",
        "fiscal_year": 2023,
        "period_end": date(2023, 9, 30),
        "filed_date": date(2023, 11, 3),
        "value": Decimal("383285000000"),
        "unit": "USD",
    },
    {
        "metric_key": "revenue",
        "fiscal_year": 2024,
        "period_end": date(2024, 9, 28),
        "filed_date": date(2024, 11, 1),
        "value": Decimal("391035000000"),
        "unit": "USD",
    },
    {
        "metric_key": "net_income",
        "fiscal_year": 2023,
        "period_end": date(2023, 9, 30),
        "filed_date": date(2023, 11, 3),
        "value": Decimal("96995000000"),
        "unit": "USD",
    },
    {
        "metric_key": "net_income",
        "fiscal_year": 2024,
        "period_end": date(2024, 9, 28),
        "filed_date": date(2024, 11, 1),
        "value": Decimal("100913000000"),
        "unit": "USD",
    },
    {
        "metric_key": "diluted_eps",
        "fiscal_year": 2023,
        "period_end": date(2023, 9, 30),
        "filed_date": date(2023, 11, 3),
        "value": Decimal("6.13"),
        "unit": "USD/shares",
    },
    {
        "metric_key": "diluted_eps",
        "fiscal_year": 2024,
        "period_end": date(2024, 9, 28),
        "filed_date": date(2024, 11, 1),
        "value": Decimal("6.75"),
        "unit": "USD/shares",
    },
    {
        "metric_key": "free_cash_flow",
        "fiscal_year": 2023,
        "period_end": date(2023, 9, 30),
        "filed_date": date(2023, 11, 3),
        "value": Decimal("99584000000"),
        "unit": "USD",
    },
    {
        "metric_key": "free_cash_flow",
        "fiscal_year": 2024,
        "period_end": date(2024, 9, 28),
        "filed_date": date(2024, 11, 1),
        "value": Decimal("108807000000"),
        "unit": "USD",
    },
    {
        "metric_key": "gross_profit",
        "fiscal_year": 2023,
        "period_end": date(2023, 9, 30),
        "filed_date": date(2023, 11, 3),
        "value": Decimal("169148000000"),
        "unit": "USD",
    },
    {
        "metric_key": "gross_profit",
        "fiscal_year": 2024,
        "period_end": date(2024, 9, 28),
        "filed_date": date(2024, 11, 1),
        "value": Decimal("180664000000"),
        "unit": "USD",
    },
    {
        "metric_key": "operating_income",
        "fiscal_year": 2023,
        "period_end": date(2023, 9, 30),
        "filed_date": date(2023, 11, 3),
        "value": Decimal("114301000000"),
        "unit": "USD",
    },
    {
        "metric_key": "operating_income",
        "fiscal_year": 2024,
        "period_end": date(2024, 9, 28),
        "filed_date": date(2024, 11, 1),
        "value": Decimal("122303000000"),
        "unit": "USD",
    },
    {
        "metric_key": "operating_cash_flow",
        "fiscal_year": 2024,
        "period_end": date(2024, 9, 28),
        "filed_date": date(2024, 11, 1),
        "value": Decimal("118254000000"),
        "unit": "USD",
    },
    {
        "metric_key": "capital_expenditures",
        "fiscal_year": 2024,
        "period_end": date(2024, 9, 28),
        "filed_date": date(2024, 11, 1),
        "value": Decimal("-9447000000"),
        "unit": "USD",
    },
    {
        "metric_key": "total_debt",
        "fiscal_year": 2024,
        "period_end": date(2024, 9, 28),
        "filed_date": date(2024, 11, 1),
        "value": Decimal("106629000000"),
        "unit": "USD",
    },
    {
        "metric_key": "shareholders_equity",
        "fiscal_year": 2024,
        "period_end": date(2024, 9, 28),
        "filed_date": date(2024, 11, 1),
        "value": Decimal("56950000000"),
        "unit": "USD",
    },
    {
        "metric_key": "cash_and_equivalents",
        "fiscal_year": 2024,
        "period_end": date(2024, 9, 28),
        "filed_date": date(2024, 11, 1),
        "value": Decimal("29943000000"),
        "unit": "USD",
    },
]

QUARTERLY_FACTS = [
    {
        "metric_key": "revenue",
        "fiscal_year": 2025,
        "fiscal_quarter": 1,
        "period_end": date(2024, 12, 28),
        "filed_date": date(2025, 1, 30),
        "value": Decimal("124300000000"),
        "unit": "USD",
    },
    {
        "metric_key": "net_income",
        "fiscal_year": 2025,
        "fiscal_quarter": 1,
        "period_end": date(2024, 12, 28),
        "filed_date": date(2025, 1, 30),
        "value": Decimal("36330000000"),
        "unit": "USD",
    },
    {
        "metric_key": "diluted_eps",
        "fiscal_year": 2025,
        "fiscal_quarter": 1,
        "period_end": date(2024, 12, 28),
        "filed_date": date(2025, 1, 30),
        "value": Decimal("2.40"),
        "unit": "USD/shares",
    },
]


def _price_point(point_date, open_price, high_price, low_price, close_price, volume):
    return {
        "date": point_date.isoformat(),
        "open": float(open_price),
        "high": float(high_price),
        "low": float(low_price),
        "close": float(close_price),
        "adjusted_close": float(close_price),
        "volume": int(volume),
    }


def _build_price_cache_defaults(now):
    return {
        "1Y": {
            "sampling_granularity": "trading-day",
            "source_updated_at": now - timedelta(minutes=20),
            "data_json": [
                _price_point(date(2025, 3, 24), "170.12", "171.83", "169.44", "171.01", 62_000_000),
                _price_point(date(2025, 6, 24), "181.70", "183.20", "180.90", "182.56", 58_000_000),
                _price_point(date(2025, 9, 24), "188.25", "189.40", "186.80", "187.64", 55_000_000),
                _price_point(date(2025, 12, 24), "191.20", "193.05", "190.10", "192.44", 49_000_000),
                _price_point(date(2026, 3, 20), "194.10", "196.30", "193.80", "195.25", 51_000_000),
            ],
        },
        "5Y": {
            "sampling_granularity": "weekly",
            "source_updated_at": now - timedelta(hours=3),
            "data_json": [
                _price_point(date(2021, 3, 26), "120.35", "122.10", "119.75", "121.21", 91_000_000),
                _price_point(date(2022, 3, 25), "161.75", "165.20", "160.10", "163.98", 84_000_000),
                _price_point(date(2023, 3, 24), "155.44", "160.32", "154.70", "158.93", 77_000_000),
                _price_point(date(2024, 3, 22), "171.12", "173.50", "169.85", "172.28", 64_000_000),
                _price_point(date(2025, 3, 21), "193.44", "196.30", "192.80", "195.25", 51_000_000),
            ],
        },
    }


class Command(BaseCommand):
    help = "Seed a tiny deterministic StockPulse dataset for Playwright smoke tests."

    @transaction.atomic
    def handle(self, *args, **options):
        now = timezone.now()

        company = Company.objects.filter(ticker=COMPANY_TICKER).first()
        if company is None:
            company = Company.objects.filter(cik=COMPANY_CIK).first()

        if company is None:
            company = Company.objects.create(
                **COMPANY_DEFAULTS,
                quote_updated_at=now - timedelta(minutes=15),
                facts_updated_at=now - timedelta(hours=6),
            )
            company_created = True
        else:
            company_created = False
            for field, value in COMPANY_DEFAULTS.items():
                setattr(company, field, value)
            company.quote_updated_at = now - timedelta(minutes=15)
            company.facts_updated_at = now - timedelta(hours=6)
            company.save()

        MetricSnapshot.objects.update_or_create(
            company=company,
            defaults=SNAPSHOT_DEFAULTS,
        )

        created_facts = 0
        for fact in [*ANNUAL_FACTS, *QUARTERLY_FACTS]:
            _, created = FinancialFact.objects.update_or_create(
                company=company,
                metric_key=fact["metric_key"],
                period_type="quarterly" if fact.get("fiscal_quarter") else "annual",
                fiscal_year=fact["fiscal_year"],
                period_end=fact["period_end"],
                defaults={
                    "fiscal_quarter": fact.get("fiscal_quarter"),
                    "period_start": None,
                    "value": fact["value"],
                    "unit": fact["unit"],
                    "source_tag": "smoke-seed",
                    "source_form": "10-K" if not fact.get("fiscal_quarter") else "10-Q",
                    "filed_date": fact["filed_date"],
                    "is_amended": False,
                    "is_derived": False,
                    "selection_reason": "smoke_seed",
                },
            )
            created_facts += int(created)

        created_caches = 0
        for range_key, defaults in _build_price_cache_defaults(now).items():
            _, created = PriceCache.objects.update_or_create(
                company=company,
                range_key=range_key,
                defaults={
                    "sampling_granularity": defaults["sampling_granularity"],
                    "data_json": defaults["data_json"],
                    "is_stale": False,
                    "source_updated_at": defaults["source_updated_at"],
                },
            )
            created_caches += int(created)

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded smoke data for "
                f"{company.ticker}: company={'created' if company_created else 'updated'}, "
                f"facts={len(ANNUAL_FACTS) + len(QUARTERLY_FACTS)} "
                f"({created_facts} created), price_caches=2 ({created_caches} created)."
            )
        )
