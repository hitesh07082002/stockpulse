from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from stocks.models import Company, FinancialFact, StockMetrics


class Command(BaseCommand):
    help = "Compute StockMetrics from FinancialFacts for every Company."

    def _latest_annual_value(self, company, metric):
        """Return the value of the most recent annual FinancialFact for a metric, or None."""
        fact = (
            FinancialFact.objects
            .filter(company=company, metric=metric, period_type='annual')
            .order_by('-fiscal_year')
            .first()
        )
        return fact.value if fact else None

    def _previous_annual_value(self, company, metric):
        """Return the value of the second-most-recent annual FinancialFact for a metric, or None."""
        facts = (
            FinancialFact.objects
            .filter(company=company, metric=metric, period_type='annual')
            .order_by('-fiscal_year')
            .values_list('value', flat=True)[:2]
        )
        return list(facts)[1] if len(facts) >= 2 else None

    def _safe_divide(self, numerator, denominator):
        """Divide two Decimals, returning None when either is None or denominator is zero."""
        if numerator is None or denominator is None:
            return None
        if denominator == 0:
            return None
        return numerator / denominator

    def _compute_for_company(self, company):
        """Compute all metrics for a single company and upsert the StockMetrics row."""
        current_price = company.current_price  # Decimal or None

        eps_diluted = self._latest_annual_value(company, 'eps_diluted')
        dividends_per_share = self._latest_annual_value(company, 'dividends_per_share')
        revenue = self._latest_annual_value(company, 'revenue')
        revenue_prev = self._previous_annual_value(company, 'revenue')
        net_income = self._latest_annual_value(company, 'net_income')
        gross_profit = self._latest_annual_value(company, 'gross_profit')
        operating_income = self._latest_annual_value(company, 'operating_income')
        total_equity = self._latest_annual_value(company, 'total_equity')
        total_debt = self._latest_annual_value(company, 'total_debt')
        operating_cash_flow = self._latest_annual_value(company, 'operating_cash_flow')
        capital_expenditures = self._latest_annual_value(company, 'capital_expenditures')

        # pe_ratio = current_price / eps_diluted (eps > 0)
        pe_ratio = None
        if current_price is not None and eps_diluted is not None and eps_diluted > 0:
            pe_ratio = current_price / eps_diluted

        # dividend_yield = dividends_per_share / current_price
        dividend_yield = self._safe_divide(dividends_per_share, current_price)

        # revenue_growth_yoy
        revenue_growth_yoy = None
        if revenue is not None and revenue_prev is not None and revenue_prev != 0:
            revenue_growth_yoy = (revenue - revenue_prev) / abs(revenue_prev)

        # profit_margin = net_income / revenue
        profit_margin = self._safe_divide(net_income, revenue)

        # gross_margin = gross_profit / revenue
        gross_margin = self._safe_divide(gross_profit, revenue)

        # operating_margin = operating_income / revenue
        operating_margin = self._safe_divide(operating_income, revenue)

        # roe = net_income / total_equity
        roe = self._safe_divide(net_income, total_equity)

        # debt_to_equity = total_debt / total_equity
        debt_to_equity = self._safe_divide(total_debt, total_equity)

        # free_cash_flow = operating_cash_flow - capital_expenditures
        free_cash_flow = None
        if operating_cash_flow is not None and capital_expenditures is not None:
            free_cash_flow = operating_cash_flow - capital_expenditures

        StockMetrics.objects.update_or_create(
            company=company,
            defaults={
                'pe_ratio': pe_ratio,
                'dividend_yield': dividend_yield,
                'revenue_growth_yoy': revenue_growth_yoy,
                'profit_margin': profit_margin,
                'gross_margin': gross_margin,
                'operating_margin': operating_margin,
                'roe': roe,
                'debt_to_equity': debt_to_equity,
                'free_cash_flow': free_cash_flow,
            },
        )

    def handle(self, *args, **options):
        companies = Company.objects.all()
        count = 0

        for company in companies.iterator():
            self._compute_for_company(company)
            count += 1

        self.stdout.write(
            self.style.SUCCESS(f"{count} companies processed")
        )
