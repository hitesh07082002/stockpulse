import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from stocks.models import Company

CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "sp500.csv"


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
            rows = list(reader)

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
                exists = Company.objects.filter(ticker=row["ticker"]).exists()
                action = "UPDATE" if exists else "CREATE"
                self.stdout.write(f"[DRY RUN] {action} {row['ticker']} — {row['name']}")
                if exists:
                    updated += 1
                else:
                    created += 1
            else:
                _, was_created = Company.objects.update_or_create(
                    ticker=row["ticker"],
                    defaults=defaults,
                )
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
