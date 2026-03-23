import csv
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import yfinance as yf
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from stocks.models import Company, IngestionRun


OVERRIDES_CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "company_metadata_overrides.csv"
METADATA_FIELDS = ("description", "website", "exchange")
REQUIRED_OVERRIDE_COLUMNS = {"ticker", *METADATA_FIELDS}
EXCHANGE_NORMALIZATION = {
    "nasdaq": "NASDAQ",
    "nasdaq capital market": "NASDAQ",
    "nasdaqgs": "NASDAQ",
    "nasdaqgm": "NASDAQ",
    "nasdaqcm": "NASDAQ",
    "nms": "NASDAQ",
    "nyse": "NYSE",
    "new york stock exchange": "NYSE",
    "nyq": "NYSE",
    "nyse american": "NYSE American",
    "nyseamerican": "NYSE American",
    "amex": "NYSE American",
    "ase": "NYSE American",
    "nyse arca": "NYSE Arca",
    "nysearca": "NYSE Arca",
    "pcx": "NYSE Arca",
    "cboe": "Cboe",
    "bats": "Cboe",
}


class Command(BaseCommand):
    help = "Enrich company metadata (description, website, exchange) from Yahoo and override CSV."

    def add_arguments(self, parser):
        parser.add_argument(
            "--ticker",
            type=str,
            default=None,
            help="Enrich only this ticker instead of all companies.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Refresh populated metadata fields when upstream or overrides provide a non-empty replacement.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview metadata changes without writing to the database.",
        )
        parser.add_argument(
            "--csv",
            type=str,
            default=str(OVERRIDES_CSV_PATH),
            help="Path to the metadata override CSV.",
        )

    def handle(self, *args, **options):
        ticker_filter = (options["ticker"] or "").strip().upper()
        dry_run = options["dry_run"]
        force = options["force"]
        overrides_path = Path(options["csv"]).expanduser()
        overrides = _load_overrides(overrides_path)

        if ticker_filter:
            companies = Company.objects.filter(ticker__iexact=ticker_filter).order_by("ticker")
            if not companies.exists():
                self.stderr.write(
                    self.style.ERROR(f"No company found with ticker '{ticker_filter}'")
                )
                return
        else:
            companies = Company.objects.order_by("ticker")

        total = companies.count()
        updated_companies = 0
        failed = 0

        self.stdout.write(f"Enriching metadata for {total} company(ies)...\n")

        for company in companies:
            override_values = overrides.get(company.ticker, {})
            fetched_values = {}
            fetch_error = None

            try:
                fetched_values = _fetch_metadata(company.ticker)
            except Exception as exc:  # noqa: BLE001 - command should continue per ticker
                fetch_error = str(exc)[:1000]

            if not fetched_values and not override_values:
                failed += 1
                if not dry_run:
                    _record_run(
                        company=company,
                        status=IngestionRun.STATUS_FAILED,
                        details_json={
                            "error": fetch_error or "No metadata returned",
                            "updated_fields": [],
                            "sources": {},
                        },
                    )
                self.stderr.write(
                    self.style.WARNING(
                        f"  FAIL {company.ticker} — {fetch_error or 'No metadata returned'}"
                    )
                )
                continue

            changed_fields, source_fields = _apply_metadata(
                company=company,
                fetched_values=fetched_values,
                override_values=override_values,
                force=force,
                dry_run=dry_run,
            )

            if changed_fields:
                updated_companies += 1

            if not dry_run:
                _record_run(
                    company=company,
                    status=IngestionRun.STATUS_SUCCESS,
                    details_json={
                        "updated_fields": changed_fields,
                        "sources": source_fields,
                        "override_fields": sorted(override_values.keys()),
                        "fetch_error": fetch_error,
                    },
                )

            prefix = "[DRY RUN] " if dry_run else ""
            field_summary = ", ".join(changed_fields) if changed_fields else "no field changes"
            self.stdout.write(f"  {prefix}OK  {company.ticker} — {field_summary}")

        remaining = Company.objects.filter(pk__in=companies.values("pk"))
        description_filled = remaining.exclude(description="").count()
        website_filled = remaining.exclude(website="").count()
        exchange_filled = remaining.exclude(exchange="").count()

        self.stdout.write("")
        prefix = "[DRY RUN] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}Done. {updated_companies} company rows updated, {failed} failed (of {total})."
            )
        )
        self.stdout.write(
            f"{prefix}Coverage — descriptions: {description_filled}/{total}, "
            f"websites: {website_filled}/{total}, exchanges: {exchange_filled}/{total}"
        )


def _record_run(*, company, status, details_json):
    IngestionRun.objects.create(
        company=company,
        source=IngestionRun.SOURCE_METADATA,
        status=status,
        details_json=details_json,
        completed_at=timezone.now(),
    )


def _fetch_metadata(ticker):
    stock = yf.Ticker(ticker)
    info = getattr(stock, "info", None) or {}
    return _normalize_metadata(info)


def _apply_metadata(*, company, fetched_values, override_values, force, dry_run):
    changed_fields = []
    source_fields = {}

    for field in METADATA_FIELDS:
        source = None
        proposed = override_values.get(field)
        if proposed:
            source = "override"
        else:
            proposed = fetched_values.get(field)
            if proposed:
                source = "yahoo"

        if not proposed:
            continue

        if getattr(company, field) == proposed:
            continue

        if not force and getattr(company, field):
            continue

        setattr(company, field, proposed)
        changed_fields.append(field)
        source_fields[field] = source

    if changed_fields and not dry_run:
        company.save(update_fields=changed_fields)

    return changed_fields, source_fields


def _normalize_metadata(info):
    description = _normalize_text(info.get("longBusinessSummary"))
    website = _normalize_website(info.get("website"))
    exchange = _normalize_exchange(
        info.get("fullExchangeName") or info.get("exchange")
    )

    metadata = {
        "description": description,
        "website": website,
        "exchange": exchange,
    }
    return {field: value for field, value in metadata.items() if value}


def _normalize_text(value):
    if not value:
        return ""
    return " ".join(str(value).split())


def _normalize_website(value):
    if not value:
        return ""

    raw = str(value).strip()
    if not raw:
        return ""

    if "://" not in raw:
        raw = f"https://{raw}"

    parsed = urlsplit(raw)
    if not parsed.netloc:
        return ""

    normalized = urlunsplit(
        (
            parsed.scheme.lower() or "https",
            parsed.netloc.lower(),
            parsed.path.rstrip("/"),
            parsed.query,
            parsed.fragment,
        )
    )
    return normalized


def _normalize_exchange(value):
    if not value:
        return ""

    raw = " ".join(str(value).split())
    if not raw:
        return ""

    return EXCHANGE_NORMALIZATION.get(raw.lower(), raw)


def _load_overrides(csv_path):
    if not csv_path.exists():
        raise CommandError(f"Override CSV file not found: {csv_path}")

    with open(csv_path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = set(reader.fieldnames or [])
        if not REQUIRED_OVERRIDE_COLUMNS.issubset(fieldnames):
            missing = sorted(REQUIRED_OVERRIDE_COLUMNS - fieldnames)
            raise CommandError(
                f"Override CSV missing required columns: {', '.join(missing)}"
            )

        overrides = {}
        for row in reader:
            ticker = (row.get("ticker") or "").strip().upper()
            if not ticker:
                continue

            cleaned = {}
            description = _normalize_text(row.get("description"))
            website = _normalize_website(row.get("website"))
            exchange = _normalize_exchange(row.get("exchange"))
            if description:
                cleaned["description"] = description
            if website:
                cleaned["website"] = website
            if exchange:
                cleaned["exchange"] = exchange
            overrides[ticker] = cleaned

    return overrides
