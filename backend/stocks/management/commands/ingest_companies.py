import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from stocks.models import Company

CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "sp500.csv"

PREFERRED_MULTI_CLASS_TICKERS = {
    "1564708": "NWSA",
    "1652044": "GOOGL",
    "1754301": "FOXA",
}


class Command(BaseCommand):
    help = "Load S&P 500 companies from sp500.csv into the Company table."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without writing to the database.",
        )
        parser.add_argument(
            "--csv",
            type=str,
            default=str(CSV_PATH),
            help="Path to the source CSV file.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        csv_path = Path(options["csv"]).expanduser()

        if not csv_path.exists():
            raise CommandError(f"CSV file not found: {csv_path}")

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = self._dedupe_company_rows(list(reader))

        created = 0
        updated = 0

        for row in rows:
            defaults = {
                "name": row["name"],
                "sector": row["sector"],
                "industry": row["industry"],
                "cik": row["cik"],
            }

            if dry_run:
                exists = Company.objects.filter(
                    Q(ticker=row["ticker"]) | Q(cik=row["cik"])
                ).exists()
                action = "UPDATE" if exists else "CREATE"
                self.stdout.write(f"[DRY RUN] {action} {row['ticker']} — {row['name']}")
                if exists:
                    updated += 1
                else:
                    created += 1
            else:
                was_created = self._upsert_company(row, defaults)
                if was_created:
                    created += 1
                else:
                    updated += 1

        prefix = "[DRY RUN] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}Done: {created} created, {updated} updated, {len(rows)} total rows processed."
            )
        )

    def _dedupe_company_rows(self, rows):
        rows_by_cik = {}

        for row in rows:
            cik = str(row["cik"]).lstrip("0") or "0"
            normalized = {
                "ticker": row["ticker"],
                "name": row["name"],
                "sector": row["sector"],
                "industry": row["industry"],
                "cik": cik,
            }

            current = rows_by_cik.get(cik)
            if current is None:
                rows_by_cik[cik] = normalized
                continue

            preferred = PREFERRED_MULTI_CLASS_TICKERS.get(cik)
            if preferred and normalized["ticker"] == preferred:
                rows_by_cik[cik] = normalized
                continue

            if preferred and current["ticker"] == preferred:
                continue

            if normalized["ticker"] < current["ticker"]:
                rows_by_cik[cik] = normalized

        return [rows_by_cik[cik] for cik in sorted(rows_by_cik, key=lambda value: rows_by_cik[value]["ticker"])]

    def _upsert_company(self, row, defaults):
        with transaction.atomic():
            company = Company.objects.filter(
                Q(ticker=row["ticker"]) | Q(cik=row["cik"])
            ).first()
            if company is None:
                Company.objects.create(ticker=row["ticker"], **defaults)
                return True

            company.ticker = row["ticker"]
            company.name = defaults["name"]
            company.sector = defaults["sector"]
            company.industry = defaults["industry"]
            company.cik = defaults["cik"]
            company.save(update_fields=["ticker", "name", "sector", "industry", "cik"])
            return False
