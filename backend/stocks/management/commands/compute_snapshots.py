from collections import defaultdict
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Prefetch
from django.utils import timezone

from stocks.models import Company, FinancialFact, IngestionRun, MetricSnapshot


SNAPSHOT_INPUT_METRICS = (
    "revenue",
    "gross_profit",
    "operating_income",
    "net_income",
    "diluted_eps",
    "operating_cash_flow",
    "capital_expenditures",
    "free_cash_flow",
    "total_debt",
    "shareholders_equity",
)


class Command(BaseCommand):
    help = "Compute canonical MetricSnapshot rows from annual FinancialFact rows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--ticker",
            type=str,
            default=None,
            help="Recompute snapshots for a single ticker instead of all companies.",
        )

    def handle(self, *args, **options):
        ticker = options["ticker"]
        companies = self._companies_queryset(ticker)

        if ticker and not companies.exists():
            raise CommandError(f"No company found with ticker '{ticker}'")

        run = IngestionRun.objects.create(
            company=companies.first() if ticker else None,
            source=IngestionRun.SOURCE_SNAPSHOTS,
            status=IngestionRun.STATUS_IN_PROGRESS,
            details_json={"ticker": ticker} if ticker else {},
        )

        processed = 0
        created = 0
        updated = 0
        deleted = 0

        try:
            for company in companies:
                outcome = self._recompute_company(company)
                processed += 1

                if outcome == "created":
                    created += 1
                elif outcome == "updated":
                    updated += 1
                elif outcome == "deleted":
                    deleted += 1

            run.status = IngestionRun.STATUS_SUCCESS
            run.completed_at = timezone.now()
            run.details_json = {
                "ticker": ticker,
                "processed": processed,
                "created": created,
                "updated": updated,
                "deleted": deleted,
            }
            run.save(update_fields=["status", "completed_at", "details_json"])
        except Exception as exc:
            run.status = IngestionRun.STATUS_FAILED
            run.completed_at = timezone.now()
            run.details_json = {
                "ticker": ticker,
                "processed": processed,
                "created": created,
                "updated": updated,
                "deleted": deleted,
                "error": str(exc),
            }
            run.save(update_fields=["status", "completed_at", "details_json"])
            raise

        self.stdout.write(
            self.style.SUCCESS(
                f"{processed} companies processed "
                f"({created} created, {updated} updated, {deleted} deleted)"
            )
        )

    def _companies_queryset(self, ticker=None):
        annual_facts = FinancialFact.objects.filter(
            period_type=FinancialFact.PERIOD_ANNUAL,
            metric_key__in=SNAPSHOT_INPUT_METRICS,
        ).order_by("-fiscal_year", "-period_end", "-filed_date", "-id")

        queryset = Company.objects.order_by("ticker").prefetch_related(
            Prefetch("financial_facts", queryset=annual_facts)
        )

        if ticker:
            queryset = queryset.filter(ticker__iexact=ticker)

        return queryset

    def _recompute_company(self, company):
        facts_by_metric = defaultdict(list)
        for fact in company.financial_facts.all():
            facts_by_metric[fact.metric_key].append(fact)

        if not facts_by_metric:
            deleted_count, _ = MetricSnapshot.objects.filter(company=company).delete()
            return "deleted" if deleted_count else "skipped"

        snapshot_defaults = self._build_snapshot_defaults(company, facts_by_metric)
        if all(value is None for value in snapshot_defaults.values()):
            deleted_count, _ = MetricSnapshot.objects.filter(company=company).delete()
            return "deleted" if deleted_count else "skipped"

        _, created = MetricSnapshot.objects.update_or_create(
            company=company,
            defaults=snapshot_defaults,
        )
        return "created" if created else "updated"

    def _build_snapshot_defaults(self, company, facts_by_metric):
        revenue = self._latest_annual_value(facts_by_metric, "revenue")
        previous_revenue = self._previous_annual_value(facts_by_metric, "revenue")
        gross_profit = self._latest_annual_value(facts_by_metric, "gross_profit")
        operating_income = self._latest_annual_value(facts_by_metric, "operating_income")
        net_income = self._latest_annual_value(facts_by_metric, "net_income")
        diluted_eps = self._latest_annual_value(facts_by_metric, "diluted_eps")
        shareholders_equity = self._latest_annual_value(facts_by_metric, "shareholders_equity")
        total_debt = self._latest_annual_value(facts_by_metric, "total_debt")
        free_cash_flow = self._latest_annual_value(facts_by_metric, "free_cash_flow")

        if free_cash_flow is None:
            operating_cash_flow = self._latest_annual_value(facts_by_metric, "operating_cash_flow")
            capital_expenditures = self._latest_annual_value(facts_by_metric, "capital_expenditures")
            if operating_cash_flow is not None and capital_expenditures is not None:
                free_cash_flow = operating_cash_flow - capital_expenditures

        pe_ratio = None
        if company.current_price is not None and diluted_eps is not None and diluted_eps > 0:
            pe_ratio = company.current_price / diluted_eps

        revenue_growth_yoy = None
        if revenue is not None and previous_revenue not in (None, Decimal("0")):
            revenue_growth_yoy = (revenue - previous_revenue) / abs(previous_revenue)

        return {
            "pe_ratio": pe_ratio,
            "dividend_yield": None,
            "revenue_growth_yoy": revenue_growth_yoy,
            "gross_margin": self._safe_divide(gross_profit, revenue),
            "operating_margin": self._safe_divide(operating_income, revenue),
            "net_margin": self._safe_divide(net_income, revenue),
            "roe": self._safe_divide(net_income, shareholders_equity),
            "debt_to_equity": self._safe_divide(total_debt, shareholders_equity),
            "free_cash_flow": free_cash_flow,
        }

    def _latest_annual_value(self, facts_by_metric, metric_key):
        facts = facts_by_metric.get(metric_key, ())
        return facts[0].value if facts else None

    def _previous_annual_value(self, facts_by_metric, metric_key):
        facts = facts_by_metric.get(metric_key, ())
        return facts[1].value if len(facts) > 1 else None

    def _safe_divide(self, numerator, denominator):
        if numerator is None or denominator in (None, Decimal("0")):
            return None
        return numerator / denominator
