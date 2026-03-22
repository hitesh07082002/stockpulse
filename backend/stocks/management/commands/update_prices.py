import yfinance as yf
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand
from django.utils import timezone

from stocks.models import Company, IngestionLog


class Command(BaseCommand):
    help = "Update cached price data from yfinance for all companies (or a single --ticker)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--ticker",
            type=str,
            default=None,
            help="Update only this ticker instead of all companies.",
        )

    def handle(self, *args, **options):
        ticker_filter = options["ticker"]

        if ticker_filter:
            companies = Company.objects.filter(ticker__iexact=ticker_filter)
            if not companies.exists():
                self.stderr.write(self.style.ERROR(f"No company found with ticker '{ticker_filter}'"))
                return
        else:
            companies = Company.objects.all()

        total = companies.count()
        updated = 0
        failed = 0

        self.stdout.write(f"Updating prices for {total} company(ies)...\n")

        for company in companies:
            log = IngestionLog.objects.create(
                company=company,
                source="yfinance",
                status="in_progress",
            )

            try:
                stock = yf.Ticker(company.ticker)
                info = stock.info

                if not info or info.get("regularMarketPrice") is None:
                    raise ValueError(f"No price data returned for {company.ticker}")

                company.current_price = _to_decimal(info.get("regularMarketPrice"))
                company.market_cap = info.get("marketCap")
                company.week_52_high = _to_decimal(info.get("fiftyTwoWeekHigh"))
                company.week_52_low = _to_decimal(info.get("fiftyTwoWeekLow"))
                company.shares_outstanding = info.get("sharesOutstanding")
                company.price_updated_at = timezone.now()
                company.save(update_fields=[
                    "current_price",
                    "market_cap",
                    "week_52_high",
                    "week_52_low",
                    "shares_outstanding",
                    "price_updated_at",
                ])

                log.status = "success"
                log.records_created = 1
                log.completed_at = timezone.now()
                log.save(update_fields=["status", "records_created", "completed_at"])

                updated += 1
                self.stdout.write(f"  OK  {company.ticker} — ${company.current_price}")

            except Exception as exc:
                failed += 1

                log.status = "failed"
                log.error_message = str(exc)[:1000]
                log.completed_at = timezone.now()
                log.save(update_fields=["status", "error_message", "completed_at"])

                self.stderr.write(self.style.WARNING(f"  FAIL {company.ticker} — {exc}"))

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Done. {updated} updated, {failed} failed (of {total})."))


def _to_decimal(value):
    """Safely convert a value to Decimal, returning None on failure."""
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
