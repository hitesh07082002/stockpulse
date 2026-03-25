from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

import yfinance as yf
from django.core.management.base import BaseCommand
from django.utils import timezone

from stocks.models import Company, IngestionRun


@dataclass
class QuoteSnapshot:
    current_price: Decimal | None
    market_cap: int | None
    week_52_high: Decimal | None
    week_52_low: Decimal | None
    shares_outstanding: int | None


class Command(BaseCommand):
    help = "Update cached price data from yfinance for all companies (or a single --ticker)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--ticker",
            type=str,
            default=None,
            help="Update only this ticker instead of all companies.",
        )
        parser.add_argument(
            "--workers",
            type=int,
            default=6,
            help="Number of concurrent yfinance fetches to run.",
        )

    def handle(self, *args, **options):
        ticker_filter = options["ticker"]
        workers = max(1, options["workers"])

        if ticker_filter:
            companies = Company.objects.filter(ticker__iexact=ticker_filter)
            if not companies.exists():
                self.stderr.write(
                    self.style.ERROR(f"No company found with ticker '{ticker_filter}'")
                )
                return
        else:
            companies = Company.objects.order_by("ticker")

        company_list = list(companies)
        total = len(company_list)
        updated = 0
        failed = 0

        self.stdout.write(f"Updating prices for {total} company(ies)...\n")

        if total == 0:
            self.stdout.write(self.style.SUCCESS("Done. 0 updated, 0 failed (of 0)."))
            return

        runs = {}
        for company in company_list:
            runs[company.pk] = IngestionRun.objects.create(
                company=company,
                source=IngestionRun.SOURCE_PRICES,
                status=IngestionRun.STATUS_IN_PROGRESS,
                details_json={},
            )

        max_workers = min(workers, total)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                company.pk: executor.submit(fetch_quote_snapshot, company.ticker)
                for company in company_list
            }

            for company in company_list:
                run = runs[company.pk]
                try:
                    snapshot = futures[company.pk].result()
                    apply_quote_snapshot(company, snapshot)
                    mark_run_success(run)

                    updated += 1
                    self.stdout.write(f"  OK  {company.ticker} — ${company.current_price}")
                except Exception as exc:  # noqa: BLE001 - command should report ticker-level failures
                    failed += 1
                    mark_run_failure(run, exc)
                    self.stderr.write(self.style.WARNING(f"  FAIL {company.ticker} — {exc}"))

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(f"Done. {updated} updated, {failed} failed (of {total}).")
        )


def _to_decimal(value):
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def fetch_quote_snapshot(ticker):
    stock = yf.Ticker(ticker)
    info = stock.info

    if not info or info.get("regularMarketPrice") is None:
        raise ValueError(f"No price data returned for {ticker}")

    return QuoteSnapshot(
        current_price=_to_decimal(info.get("regularMarketPrice")),
        market_cap=info.get("marketCap"),
        week_52_high=_to_decimal(info.get("fiftyTwoWeekHigh")),
        week_52_low=_to_decimal(info.get("fiftyTwoWeekLow")),
        shares_outstanding=info.get("sharesOutstanding"),
    )


def apply_quote_snapshot(company, snapshot):
    company.current_price = snapshot.current_price
    company.market_cap = snapshot.market_cap
    company.week_52_high = snapshot.week_52_high
    company.week_52_low = snapshot.week_52_low
    company.shares_outstanding = snapshot.shares_outstanding
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


def mark_run_success(run):
    run.status = IngestionRun.STATUS_SUCCESS
    run.details_json = {"records_updated": 1}
    run.completed_at = timezone.now()
    run.save(update_fields=["status", "details_json", "completed_at"])


def mark_run_failure(run, exc):
    run.status = IngestionRun.STATUS_FAILED
    run.details_json = {"error": str(exc)[:1000]}
    run.completed_at = timezone.now()
    run.save(update_fields=["status", "details_json", "completed_at"])
