"""
ingest_financials — Fetch SEC EDGAR company facts and rebuild canonical FinancialFact rows.

Usage:
    python manage.py ingest_financials
    python manage.py ingest_financials --ticker AAPL
    python manage.py ingest_financials --force
    python manage.py ingest_financials --from-cache
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
import time
import traceback

import requests
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from stocks.metric_registry import (
    get_metric_definition,
    list_metric_keys,
    tag_priority,
    unit_matches_family,
)
from stocks.models import Company, FinancialFact, IngestionRun, RawSecPayload
from stocks.normalization import derive_quarter_from_ytd, select_annual_fact
from stocks.xbrl_mapping import ANNUAL_FORMS, QUARTERLY_FORMS


SEC_COMPANYFACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
USER_AGENT = "StockPulse hitesh07082002@gmail.com"
REQUEST_INTERVAL = 0.1
MAX_RETRIES = 3
INITIAL_BACKOFF = 1
COOLDOWN_DAYS = 7

FP_QUARTER_MAP = {
    "Q1": 1,
    "Q2": 2,
    "Q3": 3,
    "Q4": 4,
}


class Command(BaseCommand):
    help = "Fetch SEC EDGAR company facts and rebuild canonical FinancialFact rows."

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})

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
        parser.add_argument(
            "--from-cache",
            action="store_true",
            default=False,
            help="Rebuild canonical facts from the latest retained RawSecPayload rows instead of fetching SEC again.",
        )

    def handle(self, *args, **options):
        ticker = options["ticker"]
        force = options["force"]
        from_cache = options["from_cache"]
        companies = self._resolve_companies(ticker)

        self.stdout.write(
            f"Starting SEC ingestion for {len(companies)} company(ies) "
            f"(force={force}, from_cache={from_cache})."
        )

        summary = {"success": 0, "failed": 0, "skipped": 0}
        for company in companies:
            status = self._process_company(company, force=force, from_cache=from_cache)
            summary[status] += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Ingestion complete. "
                f"success={summary['success']} "
                f"failed={summary['failed']} "
                f"skipped={summary['skipped']}"
            )
        )

    def _resolve_companies(self, ticker):
        if ticker:
            try:
                return [Company.objects.get(ticker__iexact=ticker)]
            except Company.DoesNotExist as exc:
                raise CommandError(f"Company with ticker '{ticker}' not found.") from exc
        return list(Company.objects.order_by("ticker"))

    def _process_company(self, company, *, force, from_cache):
        self.stdout.write(f"[{company.ticker}] Processing CIK={company.cik} ...")

        if not force and not from_cache and self._recently_ingested(company):
            self.stdout.write(
                f"  Skipped — successful SEC ingestion within last {COOLDOWN_DAYS} days."
            )
            return "skipped"

        run = IngestionRun.objects.create(
            company=company,
            source=IngestionRun.SOURCE_SEC,
            status=IngestionRun.STATUS_IN_PROGRESS,
            details_json={},
        )

        raw_companyfacts = None
        raw_submissions = None

        try:
            if from_cache:
                raw_companyfacts = self._latest_success_payload(
                    company,
                    RawSecPayload.SOURCE_COMPANYFACTS,
                )
                raw_submissions = self._latest_success_payload(
                    company,
                    RawSecPayload.SOURCE_SUBMISSIONS,
                )
                companyfacts_payload = raw_companyfacts.payload_json
                submissions_payload = raw_submissions.payload_json
            else:
                companyfacts_payload = self._fetch_companyfacts(company)
                raw_companyfacts = self._record_payload(
                    company=company,
                    source=RawSecPayload.SOURCE_COMPANYFACTS,
                    status=RawSecPayload.STATUS_SUCCESS,
                    payload=companyfacts_payload,
                    retention_note="latest_success",
                )
                submissions_payload = self._fetch_submissions(company)
                raw_submissions = self._record_payload(
                    company=company,
                    source=RawSecPayload.SOURCE_SUBMISSIONS,
                    status=RawSecPayload.STATUS_SUCCESS,
                    payload=submissions_payload,
                    retention_note="latest_success",
                )

            fact_models = self._build_financial_facts(company, companyfacts_payload)
            if not fact_models:
                raise ValueError("No canonical financial facts were produced from the SEC payload.")

            details = self._replace_company_facts(
                company,
                fact_models,
                raw_companyfacts,
                raw_submissions,
            )
            run.status = IngestionRun.STATUS_SUCCESS
            run.details_json = details
            run.completed_at = timezone.now()
            run.save(update_fields=["status", "details_json", "completed_at"])

            self.stdout.write(
                self.style.SUCCESS(
                    f"  Success — {details['facts_replaced']} canonical fact(s) rebuilt."
                )
            )
            return "success"

        except Exception as exc:  # noqa: BLE001 - management command should report full failure context
            if raw_companyfacts is None:
                self._record_payload(
                    company=company,
                    source=RawSecPayload.SOURCE_COMPANYFACTS,
                    status=RawSecPayload.STATUS_FAILED,
                    payload={"error": str(exc)},
                    retention_note="latest_failed",
                )
            if raw_submissions is None:
                self._record_payload(
                    company=company,
                    source=RawSecPayload.SOURCE_SUBMISSIONS,
                    status=RawSecPayload.STATUS_FAILED,
                    payload={"error": str(exc)},
                    retention_note="latest_failed",
                )

            run.status = IngestionRun.STATUS_FAILED
            run.details_json = {
                "error": str(exc),
                "traceback_tail": traceback.format_exc().splitlines()[-8:],
                "from_cache": from_cache,
            }
            run.completed_at = timezone.now()
            run.save(update_fields=["status", "details_json", "completed_at"])

            self.stderr.write(self.style.ERROR(f"  FAILED — {exc}"))
            return "failed"

    def _recently_ingested(self, company):
        cutoff = timezone.now() - timedelta(days=COOLDOWN_DAYS)
        return IngestionRun.objects.filter(
            company=company,
            source=IngestionRun.SOURCE_SEC,
            status=IngestionRun.STATUS_SUCCESS,
            started_at__gte=cutoff,
        ).exists()

    def _fetch_companyfacts(self, company):
        cik_padded = str(company.cik).zfill(10)
        url = SEC_COMPANYFACTS_URL.format(cik=cik_padded)
        return self._fetch_sec_json(url)

    def _fetch_submissions(self, company):
        cik_padded = str(company.cik).zfill(10)
        url = SEC_SUBMISSIONS_URL.format(cik=cik_padded)
        return self._fetch_sec_json(url)

    def _fetch_sec_json(self, url):
        backoff = INITIAL_BACKOFF
        last_exc = None

        for attempt in range(1, MAX_RETRIES + 1):
            time.sleep(REQUEST_INTERVAL)
            response = self.session.get(url, timeout=30)

            if response.status_code == 200:
                return response.json()

            if response.status_code == 429:
                last_exc = requests.HTTPError(
                    f"429 Too Many Requests (attempt {attempt}/{MAX_RETRIES})",
                    response=response,
                )
                if attempt < MAX_RETRIES:
                    self.stdout.write(
                        f"  Rate limited (429). Backing off {backoff}s before retry ..."
                    )
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                raise last_exc

            response.raise_for_status()

        raise last_exc or requests.HTTPError(f"Max retries exhausted while fetching {url}.")

    def _record_payload(self, *, company, source, status, payload, retention_note):
        RawSecPayload.objects.filter(
            company=company,
            source=source,
            status=status,
        ).delete()
        return RawSecPayload.objects.create(
            company=company,
            source=source,
            status=status,
            payload_json=payload,
            retention_note=retention_note,
        )

    def _latest_success_payload(self, company, source):
        payload = (
            RawSecPayload.objects.filter(
                company=company,
                source=source,
                status=RawSecPayload.STATUS_SUCCESS,
            )
            .order_by("-fetched_at")
            .first()
        )
        if payload is None:
            raise ValueError(f"No cached {source} payload found for {company.ticker}")
        return payload

    def _replace_company_facts(self, company, fact_models, raw_companyfacts, raw_submissions):
        deduped_facts, duplicate_collisions = self._dedupe_fact_models(fact_models)

        sorted_facts = sorted(
            deduped_facts,
            key=lambda fact: (
                fact.metric_key,
                fact.period_type,
                fact.fiscal_year,
                fact.fiscal_quarter or 0,
                fact.period_end or date.min,
            ),
        )

        metric_counts = defaultdict(int)
        annual_count = 0
        quarterly_count = 0
        derived_count = 0

        for fact in sorted_facts:
            metric_counts[fact.metric_key] += 1
            if fact.period_type == FinancialFact.PERIOD_ANNUAL:
                annual_count += 1
            else:
                quarterly_count += 1
            if fact.is_derived:
                derived_count += 1

        with transaction.atomic():
            FinancialFact.objects.filter(company=company).delete()
            FinancialFact.objects.bulk_create(sorted_facts)
            company.facts_updated_at = timezone.now()
            company.save(update_fields=["facts_updated_at"])

        return {
            "raw_payload_ids": {
                "companyfacts": raw_companyfacts.id,
                "submissions": raw_submissions.id,
            },
            "facts_replaced": len(sorted_facts),
            "annual_facts": annual_count,
            "quarterly_facts": quarterly_count,
            "derived_facts": derived_count,
            "duplicate_collisions": duplicate_collisions,
            "metric_counts": dict(sorted(metric_counts.items())),
        }

    def _build_financial_facts(self, company, payload):
        entries_by_metric = self._collect_metric_entries(payload)
        fact_models = []

        for metric_key in list_metric_keys():
            definition = get_metric_definition(metric_key)
            if definition.metric_class == "derived":
                continue

            metric_entries = entries_by_metric.get(metric_key, [])
            if not metric_entries:
                continue

            entries_by_year = defaultdict(list)
            for entry in metric_entries:
                fiscal_year = entry.get("fiscal_year")
                if fiscal_year is None:
                    continue
                entries_by_year[fiscal_year].append(entry)

            for fiscal_year, yearly_entries in sorted(entries_by_year.items()):
                annual_entry = self._select_annual_entry(metric_key, yearly_entries)
                if annual_entry is not None:
                    fact_models.append(
                        self._build_fact_model(
                            company,
                            metric_key=metric_key,
                            period_type=FinancialFact.PERIOD_ANNUAL,
                            fiscal_year=fiscal_year,
                            fiscal_quarter=None,
                            selected=annual_entry,
                        )
                    )

                if definition.metric_class == "instant":
                    fact_models.extend(
                        self._build_instant_quarter_facts(
                            company,
                            metric_key,
                            fiscal_year,
                            yearly_entries,
                            annual_entry,
                        )
                    )
                    continue

                fact_models.extend(
                    self._build_duration_quarter_facts(
                        company,
                        metric_key,
                        fiscal_year,
                        yearly_entries,
                        annual_entry,
                        allow_q4_derivation=(definition.metric_class == "duration"),
                    )
                )

        fact_models.extend(self._derive_gross_profit_facts(company, fact_models))
        fact_models.extend(self._derive_total_debt_facts(company, fact_models))
        fact_models.extend(self._derive_free_cash_flow_facts(company, fact_models))
        fact_models.extend(
            self._derive_missing_annual_rollups(
                company,
                fact_models,
                metric_keys=(
                    "gross_profit",
                    "cost_of_revenue",
                    "free_cash_flow",
                    "dividends_per_share",
                ),
            )
        )
        return fact_models

    def _collect_metric_entries(self, payload):
        facts_by_taxonomy = payload.get("facts", {}) or {}
        entries_by_metric = defaultdict(list)

        for metric_key in list_metric_keys():
            definition = get_metric_definition(metric_key)
            if definition.metric_class == "derived":
                continue

            for tag in definition.preferred_tags:
                for taxonomy in facts_by_taxonomy.values():
                    tag_payload = (taxonomy or {}).get(tag)
                    if not tag_payload:
                        continue

                    for unit, raw_entries in (tag_payload.get("units") or {}).items():
                        for raw_entry in raw_entries or []:
                            normalized = self._normalize_entry(metric_key, tag, unit, raw_entry)
                            if normalized is not None:
                                entries_by_metric[metric_key].append(normalized)

        return entries_by_metric

    def _normalize_entry(self, metric_key, tag, unit, raw_entry):
        fiscal_year = raw_entry.get("fy")
        value = self._to_decimal(raw_entry.get("val"))
        if fiscal_year is None or value is None:
            return None
        if raw_entry.get("segment"):
            return None

        definition = get_metric_definition(metric_key)
        if unit is None:
            return None
        if not unit_matches_family(unit, definition.allowed_unit_family):
            return None

        return {
            "metric_key": metric_key,
            "metric": metric_key,
            "tag": tag,
            "unit": unit,
            "val": value,
            "start": raw_entry.get("start"),
            "end": raw_entry.get("end"),
            "fy": fiscal_year,
            "fiscal_year": fiscal_year,
            "fp": raw_entry.get("fp"),
            "fiscal_quarter": FP_QUARTER_MAP.get(raw_entry.get("fp")),
            "form": raw_entry.get("form", ""),
            "filed": raw_entry.get("filed"),
            "frame": raw_entry.get("frame"),
            "segment": raw_entry.get("segment"),
        }

    def _select_annual_entry(self, metric_key, entries):
        definition = get_metric_definition(metric_key)
        if definition.metric_class == "instant":
            return self._select_instant_entry(
                metric_key,
                entries,
                allowed_forms=ANNUAL_FORMS,
                selection_reason="selected_annual_instant_fact",
            )

        return select_annual_fact(entries, metric_key=metric_key)

    def _build_instant_quarter_facts(
        self,
        company,
        metric_key,
        fiscal_year,
        entries,
        annual_entry,
    ):
        facts = []
        for quarter in (1, 2, 3):
            selected = self._select_instant_entry(
                metric_key,
                entries,
                allowed_forms=QUARTERLY_FORMS,
                target_quarter=quarter,
                selection_reason="selected_quarterly_instant_fact",
            )
            if selected is None:
                continue
            facts.append(
                self._build_fact_model(
                    company,
                    metric_key=metric_key,
                    period_type=FinancialFact.PERIOD_QUARTERLY,
                    fiscal_year=fiscal_year,
                    fiscal_quarter=quarter,
                    selected=selected,
                )
            )

        if annual_entry is not None:
            quarter_four_entry = {
                **annual_entry,
                "selection_reason": "selected_quarterly_instant_year_end",
            }
            facts.append(
                self._build_fact_model(
                    company,
                    metric_key=metric_key,
                    period_type=FinancialFact.PERIOD_QUARTERLY,
                    fiscal_year=fiscal_year,
                    fiscal_quarter=4,
                    selected=quarter_four_entry,
                )
            )

        return facts

    def _build_duration_quarter_facts(
        self,
        company,
        metric_key,
        fiscal_year,
        entries,
        annual_entry,
        *,
        allow_q4_derivation,
    ):
        facts = []

        q1 = self._select_duration_entry(
            metric_key,
            entries,
            target_quarter=1,
            min_days=75,
            max_days=110,
            ideal_days=91,
            selection_reason="selected_quarterly_fact",
        )
        if q1 is not None:
            facts.append(
                self._build_fact_model(
                    company,
                    metric_key=metric_key,
                    period_type=FinancialFact.PERIOD_QUARTERLY,
                    fiscal_year=fiscal_year,
                    fiscal_quarter=1,
                    selected=q1,
                )
            )

        q2 = self._select_or_derive_quarter(metric_key, entries, quarter=2, previous_ytd=q1)
        if q2 is not None:
            facts.append(
                self._build_fact_model(
                    company,
                    metric_key=metric_key,
                    period_type=FinancialFact.PERIOD_QUARTERLY,
                    fiscal_year=fiscal_year,
                    fiscal_quarter=2,
                    selected=q2,
                )
            )

        q2_ytd = self._select_duration_entry(
            metric_key,
            entries,
            target_quarter=2,
            min_days=160,
            max_days=210,
            ideal_days=182,
            selection_reason="selected_quarterly_ytd_anchor",
        )
        q3 = self._select_or_derive_quarter(metric_key, entries, quarter=3, previous_ytd=q2_ytd)
        if q3 is not None:
            facts.append(
                self._build_fact_model(
                    company,
                    metric_key=metric_key,
                    period_type=FinancialFact.PERIOD_QUARTERLY,
                    fiscal_year=fiscal_year,
                    fiscal_quarter=3,
                    selected=q3,
                )
            )

        explicit_q4 = self._select_duration_entry(
            metric_key,
            entries,
            target_quarter=4,
            min_days=75,
            max_days=110,
            ideal_days=91,
            selection_reason="selected_quarterly_fact",
            allowed_forms=ANNUAL_FORMS | QUARTERLY_FORMS,
        )
        if explicit_q4 is not None:
            facts.append(
                self._build_fact_model(
                    company,
                    metric_key=metric_key,
                    period_type=FinancialFact.PERIOD_QUARTERLY,
                    fiscal_year=fiscal_year,
                    fiscal_quarter=4,
                    selected=explicit_q4,
                )
            )
        elif allow_q4_derivation and annual_entry is not None and q1 and q2 and q3:
            q4 = self._derive_q4_from_annual(metric_key, annual_entry, q1, q2, q3)
            if q4 is not None:
                facts.append(
                    self._build_fact_model(
                        company,
                        metric_key=metric_key,
                        period_type=FinancialFact.PERIOD_QUARTERLY,
                        fiscal_year=fiscal_year,
                        fiscal_quarter=4,
                        selected=q4,
                    )
                )

        return facts

    def _select_or_derive_quarter(self, metric_key, entries, *, quarter, previous_ytd):
        explicit = self._select_duration_entry(
            metric_key,
            entries,
            target_quarter=quarter,
            min_days=75,
            max_days=110,
            ideal_days=91,
            selection_reason="selected_quarterly_fact",
        )
        if explicit is not None:
            return explicit

        ytd_bounds = {
            2: (160, 210, 182),
            3: (250, 310, 273),
        }
        min_days, max_days, ideal_days = ytd_bounds[quarter]
        current_ytd = self._select_duration_entry(
            metric_key,
            entries,
            target_quarter=quarter,
            min_days=min_days,
            max_days=max_days,
            ideal_days=ideal_days,
            selection_reason="selected_quarterly_ytd_anchor",
        )
        if previous_ytd is None or current_ytd is None:
            return None

        derived = derive_quarter_from_ytd(previous_ytd, current_ytd)
        if derived is None:
            return None

        previous_end = self._parse_iso_date(previous_ytd.get("end"))
        current_end = self._parse_iso_date(current_ytd.get("end"))
        if current_end is None:
            return None

        return {
            **derived,
            "val": derived.get("value"),
            "start": (previous_end + timedelta(days=1)).isoformat() if previous_end else None,
            "end": current_end.isoformat(),
            "filed": current_ytd.get("filed"),
        }

    def _derive_q4_from_annual(self, metric_key, annual_entry, q1, q2, q3):
        annual_value = self._to_decimal(annual_entry.get("val"))
        if annual_value is None:
            return None

        quarter_values = [self._to_decimal(entry.get("val")) for entry in (q1, q2, q3)]
        if any(value is None for value in quarter_values):
            return None

        q3_end = self._parse_iso_date(q3.get("end"))
        annual_end = self._parse_iso_date(annual_entry.get("end"))
        if annual_end is None:
            return None

        return {
            "metric_key": metric_key,
            "metric": metric_key,
            "fiscal_year": annual_entry.get("fiscal_year"),
            "fiscal_quarter": 4,
            "val": annual_value - sum(quarter_values, Decimal("0")),
            "unit": annual_entry.get("unit"),
            "source_tag": annual_entry.get("source_tag", annual_entry.get("tag", "")),
            "source_form": annual_entry.get("source_form", annual_entry.get("form", "")),
            "filed": annual_entry.get("filed"),
            "is_amended": annual_entry.get("is_amended", False),
            "is_derived": True,
            "selection_reason": "derived_q4_from_annual",
            "start": (q3_end + timedelta(days=1)).isoformat() if q3_end else None,
            "end": annual_end.isoformat(),
        }

    def _select_duration_entry(
        self,
        metric_key,
        entries,
        *,
        target_quarter,
        min_days,
        max_days,
        ideal_days,
        selection_reason,
        allowed_forms=QUARTERLY_FORMS,
    ):
        candidates = []
        for entry in entries:
            if entry.get("form") not in allowed_forms:
                continue
            if entry.get("fiscal_quarter") != target_quarter:
                continue

            duration_days = self._duration_days(entry)
            if duration_days is None or duration_days < min_days or duration_days > max_days:
                continue

            filed_ordinal = self._date_ordinal(entry.get("filed"))
            period_end = self._parse_iso_date(entry.get("end"))
            period_end_ordinal = period_end.toordinal() if period_end else 0
            period_start = self._parse_iso_date(entry.get("start"))
            period_start_ordinal = period_start.toordinal() if period_start else 0
            candidates.append(
                (
                    (
                        abs(duration_days - ideal_days),
                        -filed_ordinal,
                        -period_end_ordinal,
                        -period_start_ordinal,
                        tag_priority(metric_key, entry.get("tag", "")),
                        entry.get("tag", ""),
                        entry.get("form", ""),
                        entry.get("end", ""),
                        entry.get("start", ""),
                    ),
                    entry,
                )
            )

        if not candidates:
            return None

        _, selected = min(candidates, key=lambda candidate: candidate[0])
        return {
            **selected,
            "source_tag": selected.get("tag", ""),
            "source_form": selected.get("form", ""),
            "is_amended": self._is_amended(selected.get("form", "")),
            "selection_reason": selection_reason,
        }

    def _select_instant_entry(
        self,
        metric_key,
        entries,
        *,
        allowed_forms,
        selection_reason,
        target_quarter=None,
    ):
        candidates = []
        for entry in entries:
            if entry.get("form") not in allowed_forms:
                continue
            if target_quarter is not None and entry.get("fiscal_quarter") != target_quarter:
                continue

            period_end = self._parse_iso_date(entry.get("end"))
            if period_end is None:
                continue

            filed_ordinal = self._date_ordinal(entry.get("filed"))
            period_start = self._parse_iso_date(entry.get("start"))
            period_start_ordinal = period_start.toordinal() if period_start else 0
            candidates.append(
                (
                    (
                        -period_end.toordinal(),
                        -filed_ordinal,
                        -period_start_ordinal,
                        tag_priority(metric_key, entry.get("tag", "")),
                        entry.get("tag", ""),
                        entry.get("form", ""),
                        entry.get("end", ""),
                    ),
                    entry,
                )
            )

        if not candidates:
            return None

        _, selected = min(candidates, key=lambda candidate: candidate[0])
        return {
            **selected,
            "source_tag": selected.get("tag", ""),
            "source_form": selected.get("form", ""),
            "is_amended": self._is_amended(selected.get("form", "")),
            "selection_reason": selection_reason,
        }

    def _derive_free_cash_flow_facts(self, company, fact_models):
        facts_by_period = {}
        for fact in fact_models:
            period_key = (
                fact.period_type,
                fact.fiscal_year,
                fact.fiscal_quarter,
                fact.period_end,
            )
            facts_by_period.setdefault(period_key, {})[fact.metric_key] = fact

        derived = []
        for (period_type, fiscal_year, fiscal_quarter, period_end), facts in facts_by_period.items():
            operating_cash_flow = facts.get("operating_cash_flow")
            capital_expenditures = facts.get("capital_expenditures")
            if operating_cash_flow is None or capital_expenditures is None:
                continue

            derived.append(
                FinancialFact(
                    company=company,
                    metric_key="free_cash_flow",
                    period_type=period_type,
                    fiscal_year=fiscal_year,
                    fiscal_quarter=fiscal_quarter,
                    period_start=operating_cash_flow.period_start,
                    period_end=period_end,
                    value=operating_cash_flow.value - abs(capital_expenditures.value),
                    unit=operating_cash_flow.unit,
                    source_tag=operating_cash_flow.source_tag,
                    source_form=operating_cash_flow.source_form,
                    filed_date=operating_cash_flow.filed_date,
                    is_amended=operating_cash_flow.is_amended or capital_expenditures.is_amended,
                    is_derived=True,
                    selection_reason="derived_from_operating_cash_flow_and_capex",
                )
            )

        return derived

    def _derive_gross_profit_facts(self, company, fact_models):
        facts_by_period = self._facts_by_period(fact_models)
        derived = []

        for (period_type, fiscal_year, fiscal_quarter, period_end), facts in facts_by_period.items():
            if facts.get("gross_profit") is not None:
                continue

            revenue = facts.get("revenue")
            cost_of_revenue = facts.get("cost_of_revenue")
            if revenue is None or cost_of_revenue is None:
                continue

            derived.append(
                FinancialFact(
                    company=company,
                    metric_key="gross_profit",
                    period_type=period_type,
                    fiscal_year=fiscal_year,
                    fiscal_quarter=fiscal_quarter,
                    period_start=revenue.period_start,
                    period_end=period_end,
                    value=revenue.value - cost_of_revenue.value,
                    unit=revenue.unit,
                    source_tag=revenue.source_tag,
                    source_form=revenue.source_form,
                    filed_date=revenue.filed_date,
                    is_amended=revenue.is_amended or cost_of_revenue.is_amended,
                    is_derived=True,
                    selection_reason="derived_from_revenue_minus_cost_of_revenue",
                )
            )

        return derived

    def _derive_total_debt_facts(self, company, fact_models):
        facts_by_period = self._facts_by_period(fact_models)
        derived = []

        for (period_type, fiscal_year, fiscal_quarter, period_end), facts in facts_by_period.items():
            if facts.get("total_debt") is not None:
                continue

            debt_noncurrent = facts.get("debt_noncurrent")
            debt_current = facts.get("debt_current")
            if debt_noncurrent is None and debt_current is None:
                continue

            total_value = Decimal("0")
            period_start = None
            unit = ""
            filed_date = None
            source_form = ""
            source_tag = ""
            is_amended = False

            for component in (debt_noncurrent, debt_current):
                if component is None:
                    continue
                total_value += component.value
                period_start = period_start or component.period_start
                unit = unit or component.unit
                filed_date = filed_date or component.filed_date
                source_form = source_form or component.source_form
                source_tag = source_tag or component.source_tag
                is_amended = is_amended or component.is_amended

            derived.append(
                FinancialFact(
                    company=company,
                    metric_key="total_debt",
                    period_type=period_type,
                    fiscal_year=fiscal_year,
                    fiscal_quarter=fiscal_quarter,
                    period_start=period_start,
                    period_end=period_end,
                    value=total_value,
                    unit=unit,
                    source_tag=source_tag,
                    source_form=source_form,
                    filed_date=filed_date,
                    is_amended=is_amended,
                    is_derived=True,
                    selection_reason="derived_from_current_and_noncurrent_debt",
                )
            )

        return derived

    def _derive_missing_annual_rollups(self, company, fact_models, *, metric_keys):
        facts_by_metric_year = defaultdict(dict)
        for fact in fact_models:
            if fact.period_type == FinancialFact.PERIOD_ANNUAL:
                facts_by_metric_year[(fact.metric_key, fact.fiscal_year)]["annual"] = fact
            elif fact.fiscal_quarter is not None:
                facts_by_metric_year[(fact.metric_key, fact.fiscal_year)][fact.fiscal_quarter] = fact

        derived = []
        for metric_key in metric_keys:
            for (candidate_metric, fiscal_year), facts in facts_by_metric_year.items():
                if candidate_metric != metric_key:
                    continue
                if facts.get("annual") is not None:
                    continue

                quarters = [facts.get(quarter) for quarter in (1, 2, 3, 4)]
                if any(fact is None for fact in quarters):
                    continue

                q1, q2, q3, q4 = quarters
                derived.append(
                    FinancialFact(
                        company=company,
                        metric_key=metric_key,
                        period_type=FinancialFact.PERIOD_ANNUAL,
                        fiscal_year=fiscal_year,
                        fiscal_quarter=None,
                        period_start=q1.period_start,
                        period_end=q4.period_end,
                        value=sum((fact.value for fact in quarters), Decimal("0")),
                        unit=q1.unit,
                        source_tag=q1.source_tag,
                        source_form=q4.source_form,
                        filed_date=q4.filed_date,
                        is_amended=any(fact.is_amended for fact in quarters),
                        is_derived=True,
                        selection_reason="derived_annual_from_quarters",
                    )
                )

        return derived

    def _facts_by_period(self, fact_models):
        facts_by_period = {}
        for fact in fact_models:
            period_key = (
                fact.period_type,
                fact.fiscal_year,
                fact.fiscal_quarter,
                fact.period_end,
            )
            facts_by_period.setdefault(period_key, {})[fact.metric_key] = fact
        return facts_by_period

    def _build_fact_model(
        self,
        company,
        *,
        metric_key,
        period_type,
        fiscal_year,
        fiscal_quarter,
        selected,
    ):
        return FinancialFact(
            company=company,
            metric_key=metric_key,
            period_type=period_type,
            fiscal_year=fiscal_year,
            fiscal_quarter=fiscal_quarter,
            period_start=self._parse_iso_date(selected.get("start")),
            period_end=self._parse_iso_date(selected.get("end")),
            value=self._to_decimal(selected.get("val", selected.get("value"))),
            unit=selected.get("unit", ""),
            source_tag=selected.get("source_tag", selected.get("tag", "")),
            source_form=selected.get("source_form", selected.get("form", "")),
            filed_date=self._parse_iso_date(selected.get("filed")),
            is_amended=bool(selected.get("is_amended")),
            is_derived=bool(selected.get("is_derived")),
            selection_reason=selected.get("selection_reason", ""),
        )

    def _dedupe_fact_models(self, fact_models):
        canonical = {}
        duplicate_collisions = 0

        for fact in fact_models:
            key = (
                fact.metric_key,
                fact.period_type,
                fact.fiscal_year,
                fact.period_end,
            )
            current = canonical.get(key)
            if current is None:
                canonical[key] = fact
                continue

            duplicate_collisions += 1
            if self._fact_preference_key(fact) < self._fact_preference_key(current):
                canonical[key] = fact

        return list(canonical.values()), duplicate_collisions

    def _fact_preference_key(self, fact):
        source_rank = 0
        if fact.period_type == FinancialFact.PERIOD_QUARTERLY:
            if fact.source_form in QUARTERLY_FORMS:
                source_rank = 0
            elif fact.source_form in ANNUAL_FORMS:
                source_rank = 1
            else:
                source_rank = 2

        filed_ordinal = fact.filed_date.toordinal() if fact.filed_date else 0

        return (
            0 if not fact.is_derived else 1,
            source_rank,
            fact.fiscal_quarter or 99,
            -filed_ordinal,
            fact.source_tag,
            fact.selection_reason,
        )

    def _duration_days(self, entry):
        period_start = self._parse_iso_date(entry.get("start"))
        period_end = self._parse_iso_date(entry.get("end"))
        if period_start is None or period_end is None:
            return None
        return (period_end - period_start).days + 1

    def _date_ordinal(self, value):
        parsed = self._parse_iso_date(value)
        return parsed.toordinal() if parsed else 0

    def _parse_iso_date(self, value):
        if not value:
            return None
        try:
            return date.fromisoformat(value)
        except (TypeError, ValueError):
            return None

    def _to_decimal(self, value):
        if value is None:
            return None
        try:
            return Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return None

    def _is_amended(self, form_type):
        return str(form_type or "").endswith("/A") or str(form_type or "").endswith("-A")
