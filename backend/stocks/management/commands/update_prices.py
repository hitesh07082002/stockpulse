from decimal import Decimal, InvalidOperation

import yfinance as yf
from django.core.management.base import BaseCommand
from django.utils import timezone

from stocks.models import Company, IngestionRun


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
                self.stderr.write(
                    self.style.ERROR(f"No company found with ticker '{ticker_filter}'")
                )
                return
        else:
            companies = Company.objects.order_by("ticker")

        total = companies.count()
        updated = 0
        failed = 0

        self.stdout.write(f"Updating prices for {total} company(ies)...\n")

        for company in companies:
            run = IngestionRun.objects.create(
                company=company,
                source=IngestionRun.SOURCE_PRICES,
                status=IngestionRun.STATUS_IN_PROGRESS,
                details_json={},
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
                company.quote_updated_at = timezone.now()
                company.save(
                    update_fields=[
                        "current_price",
                        "market_cap",
                        "week_52_high",
                        "week_52_low",
                        "shares_outstanding",
                        "quote_updated_at",
                    ]
                )

                run.status = IngestionRun.STATUS_SUCCESS
                run.details_json = {"records_updated": 1}
                run.completed_at = timezone.now()
                run.save(update_fields=["status", "details_json", "completed_at"])

                updated += 1
                self.stdout.write(f"  OK  {company.ticker} — ${company.current_price}")

            except Exception as exc:  # noqa: BLE001 - command should report ticker-level failures
                failed += 1

                run.status = IngestionRun.STATUS_FAILED
                run.details_json = {"error": str(exc)[:1000]}
                run.completed_at = timezone.now()
                run.save(update_fields=["status", "details_json", "completed_at"])

                self.stderr.write(self.style.WARNING(f"  FAIL {company.ticker} — {exc}"))

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(f"Done. {updated} updated, {failed} failed (of {total}).")
        )


def _to_decimal(value):
    """Safely convert a value to Decimal, returning None on failure."""
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
