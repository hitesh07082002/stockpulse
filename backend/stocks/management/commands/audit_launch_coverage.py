from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone

from stocks.models import Company, MetricSnapshot, RawSecPayload


COVERAGE_THRESHOLD_PERCENT = 95.0

LAUNCH_CRITICAL_METRICS = (
    ("revenue", "financial_fact"),
    ("gross_profit", "financial_fact"),
    ("operating_income", "financial_fact"),
    ("net_income", "financial_fact"),
    ("free_cash_flow", "metric_snapshot"),
    ("cash_and_equivalents", "financial_fact"),
    ("total_debt", "financial_fact"),
    ("shares_outstanding", "financial_fact"),
    ("revenue_growth_yoy", "metric_snapshot"),
    ("gross_margin", "metric_snapshot"),
    ("operating_margin", "metric_snapshot"),
    ("net_margin", "metric_snapshot"),
)

RAW_TAG_APPLICABILITY = {
    "gross_profit": {
        "GrossProfit",
        "CostOfRevenue",
        "CostOfGoodsAndServicesSold",
        "CostOfServices",
        "CostOfGoodsSold",
        "CostOfGoodsAndServicesSoldDepreciationAndAmortization",
        "CostOfServicesDepreciationAndAmortization",
        "CostOfGoodsSoldDepreciationAndAmortization",
    },
    "gross_margin": {
        "GrossProfit",
        "CostOfRevenue",
        "CostOfGoodsAndServicesSold",
        "CostOfServices",
        "CostOfGoodsSold",
        "CostOfGoodsAndServicesSoldDepreciationAndAmortization",
        "CostOfServicesDepreciationAndAmortization",
        "CostOfGoodsSoldDepreciationAndAmortization",
    },
}


class Command(BaseCommand):
    help = "Audit launch-critical metric coverage across the current company universe."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default=None,
            help="Optional markdown output path for the audit report.",
        )

    def handle(self, *args, **options):
        report = self._render_report()
        output = options["output"]

        if output:
            output_path = Path(output).expanduser()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(report, encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Coverage audit written to {output_path}"))
            return

        self.stdout.write(report)

    def _render_report(self):
        generated_at = timezone.localtime().strftime("%b %d, %Y %I:%M %p %Z")
        universe = list(Company.objects.order_by("ticker").values("id", "ticker"))
        total_companies = len(universe)
        universe_by_id = {company["id"]: company["ticker"] for company in universe}
        all_company_ids = set(universe_by_id.keys())
        conditional_applicability = self._raw_tag_applicability()

        metric_rows = []
        all_meet_threshold = True

        for metric_key, source in LAUNCH_CRITICAL_METRICS:
            applicable_ids = conditional_applicability.get(metric_key, all_company_ids)
            covered_ids = self._covered_company_ids(metric_key, source)
            covered_applicable_ids = covered_ids & applicable_ids
            covered_tickers = sorted(universe_by_id[company_id] for company_id in covered_applicable_ids)
            missing_tickers = sorted(
                ticker
                for company_id, ticker in universe_by_id.items()
                if company_id in applicable_ids and company_id not in covered_ids
            )
            excluded_count = total_companies - len(applicable_ids)
            covered_count = len(covered_tickers)
            applicable_count = len(applicable_ids)
            percentage = (covered_count / applicable_count * 100.0) if applicable_count else 100.0
            meets_threshold = percentage >= COVERAGE_THRESHOLD_PERCENT
            all_meet_threshold = all_meet_threshold and meets_threshold

            metric_rows.append(
                {
                    "metric_key": metric_key,
                    "source": source,
                    "applicable_count": applicable_count,
                    "excluded_count": excluded_count,
                    "covered_count": covered_count,
                    "missing_count": applicable_count - covered_count,
                    "percentage": percentage,
                    "meets_threshold": meets_threshold,
                    "missing_tickers": missing_tickers,
                }
            )

        status_label = "PASS" if all_meet_threshold else "FAIL"

        lines = [
            "# Launch Coverage Audit",
            "",
            f"- Generated at: {generated_at}",
            f"- Universe size: {total_companies}",
            f"- Threshold: {COVERAGE_THRESHOLD_PERCENT:.1f}%",
            f"- Overall result: {status_label}",
            "",
            "## Metric Coverage",
            "",
            "| Metric | Source | Applicable | Excluded | Covered | Missing | Coverage | Threshold |",
            "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
        ]

        for row in metric_rows:
            lines.append(
                f"| {row['metric_key']} | {row['source']} | {row['applicable_count']} | "
                f"{row['excluded_count']} | {row['covered_count']} | "
                f"{row['missing_count']} | {row['percentage']:.1f}% | "
                f"{'PASS' if row['meets_threshold'] else 'FAIL'} |"
            )

        lines.extend(["", "## Known Gaps", ""])

        any_gaps = False
        for row in metric_rows:
            if not row["missing_tickers"]:
                continue
            any_gaps = True
            lines.append(f"### {row['metric_key']}")
            lines.append(
                f"Missing tickers ({row['missing_count']}): {', '.join(row['missing_tickers'])}"
            )
            lines.append("")

        if not any_gaps:
            lines.append("No gaps detected in the current universe.")

        return "\n".join(lines).rstrip() + "\n"

    def _raw_tag_applicability(self):
        applicability = {metric_key: set() for metric_key in RAW_TAG_APPLICABILITY}
        latest_payload_by_company = {}

        payloads = (
            RawSecPayload.objects.filter(
                source=RawSecPayload.SOURCE_COMPANYFACTS,
                status=RawSecPayload.STATUS_SUCCESS,
            )
            .order_by("company_id", "-fetched_at")
        )

        for payload in payloads:
            latest_payload_by_company.setdefault(payload.company_id, payload)

        for company_id, payload in latest_payload_by_company.items():
            facts = payload.payload_json.get("facts", {}).get("us-gaap", {})
            if not facts:
                continue

            available_tags = set(facts.keys())
            for metric_key, tags in RAW_TAG_APPLICABILITY.items():
                if available_tags & tags:
                    applicability[metric_key].add(company_id)

        return applicability

    def _covered_company_ids(self, metric_key, source):
        if source == "financial_fact":
            return set(
                Company.objects.filter(financial_facts__metric_key=metric_key)
                .values_list("id", flat=True)
                .distinct()
            )

        snapshot_filter = {f"metrics__{metric_key}__isnull": False}
        return set(
            Company.objects.filter(**snapshot_filter)
            .values_list("id", flat=True)
            .distinct()
        )
