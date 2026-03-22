"""
ingest_financials — Fetch SEC EDGAR XBRL company facts and upsert FinancialFact rows.

Usage:
    python manage.py ingest_financials              # all companies, skip recent
    python manage.py ingest_financials --ticker AAPL # single company
    python manage.py ingest_financials --force       # ignore 7-day cooldown
"""

import time
import traceback
from datetime import date, timedelta

import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from stocks.models import Company, FinancialFact, IngestionLog
from stocks.xbrl_mapping import ANNUAL_FORMS, QUARTERLY_FORMS, XBRL_METRIC_MAP

SEC_EDGAR_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
USER_AGENT = "StockPulse hitesh07082002@gmail.com"
REQUEST_INTERVAL = 0.1  # 10 req/sec
MAX_RETRIES = 3
INITIAL_BACKOFF = 1  # seconds
COOLDOWN_DAYS = 7

# Map fiscal-period codes from SEC to quarter integers.
FP_QUARTER_MAP = {
    "Q1": 1,
    "Q2": 2,
    "Q3": 3,
    "Q4": 4,
}


class Command(BaseCommand):
    help = "Ingest SEC EDGAR XBRL company facts into FinancialFact rows."

    # ------------------------------------------------------------------
    # CLI arguments
    # ------------------------------------------------------------------
    def add_arguments(self, parser):
        parser.add_argument(
            "--ticker",
            type=str,
            default=None,
            help="Ingest only this ticker (case-insensitive).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            default=False,
            help="Re-ingest even if a successful run exists within the last 7 days.",
        )

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------
    def handle(self, *args, **options):
        ticker = options["ticker"]
        force = options["force"]

        companies = self._resolve_companies(ticker)
        self.stdout.write(
            f"Starting ingestion for {len(companies)} company(ies) "
            f"(force={force})."
        )

        success_count = 0
        fail_count = 0

        for company in companies:
            ok = self._process_company(company, force=force)
            if ok:
                success_count += 1
            else:
                fail_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Ingestion complete. success={success_count}  failed={fail_count}"
            )
        )

    # ------------------------------------------------------------------
    # Resolve target companies
    # ------------------------------------------------------------------
    def _resolve_companies(self, ticker):
        if ticker:
            try:
                return [Company.objects.get(ticker__iexact=ticker)]
            except Company.DoesNotExist:
                raise CommandError(f"Company with ticker '{ticker}' not found.")
        return list(Company.objects.all())

    # ------------------------------------------------------------------
    # Per-company pipeline
    # ------------------------------------------------------------------
    def _process_company(self, company, *, force):
        self.stdout.write(f"[{company.ticker}] Processing CIK={company.cik} ...")

        # 1. Cooldown check
        if not force and self._recently_ingested(company):
            self.stdout.write(
                f"  Skipped — successful ingestion within last {COOLDOWN_DAYS} days."
            )
            return True

        # 2. Create in-progress log
        log = IngestionLog.objects.create(
            company=company,
            source="sec_edgar",
            status="in_progress",
        )

        try:
            # 3. Fetch raw JSON
            data = self._fetch_facts(company)

            # 4. Store raw JSON on Company
            company.raw_facts_json = data
            company.facts_updated_at = timezone.now()
            company.save(update_fields=["raw_facts_json", "facts_updated_at"])

            # 5. Parse & upsert
            records = self._parse_and_upsert(company, data)

            # 6. Mark success
            log.status = "success"
            log.records_created = records
            log.completed_at = timezone.now()
            log.save(update_fields=["status", "records_created", "completed_at"])

            self.stdout.write(
                self.style.SUCCESS(
                    f"  Success — {records} fact(s) upserted."
                )
            )
            return True

        except Exception as exc:
            log.status = "failed"
            log.error_message = f"{exc}\n{traceback.format_exc()}"
            log.completed_at = timezone.now()
            log.save(update_fields=["status", "error_message", "completed_at"])

            self.stderr.write(
                self.style.ERROR(f"  FAILED — {exc}")
            )
            return False

    # ------------------------------------------------------------------
    # Cooldown helper
    # ------------------------------------------------------------------
    def _recently_ingested(self, company):
        cutoff = timezone.now() - timedelta(days=COOLDOWN_DAYS)
        return IngestionLog.objects.filter(
            company=company,
            source="sec_edgar",
            status="success",
            started_at__gte=cutoff,
        ).exists()

    # ------------------------------------------------------------------
    # HTTP fetch with rate limiting + exponential backoff on 429
    # ------------------------------------------------------------------
    def _fetch_facts(self, company):
        cik_padded = str(company.cik).zfill(10)
        url = SEC_EDGAR_URL.format(cik=cik_padded)

        session = requests.Session()
        session.headers.update({"User-Agent": USER_AGENT})

        backoff = INITIAL_BACKOFF
        last_exc = None

        for attempt in range(1, MAX_RETRIES + 1):
            time.sleep(REQUEST_INTERVAL)  # rate limit

            response = session.get(url, timeout=30)

            if response.status_code == 200:
                return response.json()

            if response.status_code == 429:
                last_exc = requests.HTTPError(
                    f"429 Too Many Requests (attempt {attempt}/{MAX_RETRIES})",
                    response=response,
                )
                if attempt < MAX_RETRIES:
                    self.stdout.write(
                        f"  Rate-limited (429). Backing off {backoff}s ..."
                    )
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                raise last_exc

            # Any other HTTP error — fail immediately
            response.raise_for_status()

        # Should not be reached, but guard against it.
        raise last_exc or requests.HTTPError("Max retries exhausted.")

    # ------------------------------------------------------------------
    # Parse JSON → upsert FinancialFact rows
    # ------------------------------------------------------------------
    def _parse_and_upsert(self, company, data):
        us_gaap = data.get("facts", {}).get("us-gaap", {})
        upsert_count = 0

        for metric_name, xbrl_tags in XBRL_METRIC_MAP.items():
            # Try each XBRL tag in priority order; first match wins.
            tag_data = None
            for tag in xbrl_tags:
                tag_data = us_gaap.get(tag)
                if tag_data is not None:
                    break

            if tag_data is None:
                continue

            # Entries live under units -> USD (or shares, etc.).
            # Try USD first, then fall back to "shares" for share-count metrics.
            entries = tag_data.get("units", {}).get("USD")
            unit = "USD"
            if entries is None:
                entries = tag_data.get("units", {}).get("shares")
                unit = "shares"
            if entries is None:
                # Some metrics use USD/shares; try the first available unit.
                units_dict = tag_data.get("units", {})
                if units_dict:
                    unit, entries = next(iter(units_dict.items()))
            if not entries:
                continue

            for entry in entries:
                form_type = entry.get("form", "")
                if form_type in ANNUAL_FORMS:
                    period_type = "annual"
                elif form_type in QUARTERLY_FORMS:
                    period_type = "quarterly"
                else:
                    continue  # skip forms we don't care about

                fiscal_year = entry.get("fy")
                if fiscal_year is None:
                    continue

                fp = entry.get("fp", "")
                fiscal_quarter = FP_QUARTER_MAP.get(fp)
                # FY -> None (annual summary), which is the default

                end_str = entry.get("end")
                period_end_date = None
                if end_str:
                    try:
                        period_end_date = date.fromisoformat(end_str)
                    except (ValueError, TypeError):
                        pass

                value = entry.get("val")
                if value is None:
                    continue

                filed_str = entry.get("filed")
                filed_date = None
                if filed_str:
                    try:
                        filed_date = date.fromisoformat(filed_str)
                    except (ValueError, TypeError):
                        pass

                _, created = FinancialFact.objects.update_or_create(
                    company=company,
                    metric=metric_name,
                    period_type=period_type,
                    fiscal_year=fiscal_year,
                    fiscal_quarter=fiscal_quarter,
                    defaults={
                        "period_end_date": period_end_date,
                        "value": value,
                        "unit": unit,
                        "form_type": form_type,
                        "filed_date": filed_date,
                    },
                )
                upsert_count += 1

        return upsert_count
