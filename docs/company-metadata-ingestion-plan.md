# Company Metadata Ingestion Plan

## Goal

Populate `Company.description`, `Company.website`, and `Company.exchange` for the full S&P 500 universe without mixing this work into the SEC financial normalization pipeline.

This plan is intentionally separate from `ingest_financials` because company bios and website metadata do not come from SEC XBRL facts.

## Scope

In scope:
- `description`
- `website`
- `exchange`
- one-time backfill for the full 500-company universe
- idempotent re-runs for future refreshes

Out of scope:
- logos
- news
- filing-text extraction
- raw web-search answers in the AI copilot

## Source Strategy

### 1. Universe seed remains unchanged

Keep [`backend/stocks/data/sp500.csv`](../backend/stocks/data/sp500.csv) as the source for the company universe:
- `ticker`
- `name`
- `sector`
- `industry`
- `cik`

This file still defines who is in the universe. It should not become a grab-bag metadata source.

### 2. Primary metadata source

Use Yahoo Finance via `yfinance` as the primary automated metadata source for:
- `longBusinessSummary` -> `description`
- `website` -> `website`
- `exchange` -> `exchange`

Reasons:
- the project already depends on `yfinance`
- the lookup key is ticker-based, which matches the existing company universe
- it is good enough for product metadata even though it is not a canonical finance source

### 3. Curated override file

Add a curated repo file for exceptions:
- `backend/stocks/data/company_metadata_overrides.csv`

Use it when:
- Yahoo metadata is missing
- Yahoo metadata is low quality
- a company needs a manually cleaned description
- exchange labels need normalization

Override precedence:
- curated override CSV
- fetched Yahoo metadata
- existing stored values

## Command Design

Add a dedicated management command:

```bash
python manage.py enrich_company_metadata
```

Recommended options:
- `--ticker AAPL` for single-company repair
- `--force` to refresh non-empty stored metadata
- `--csv path/to/overrides.csv` to point at an alternate override file
- `--dry-run` to preview changes without writing

## Merge Rules

The command should follow these rules:

1. Never erase a non-empty stored field with an empty upstream value.
2. Only update changed fields.
3. Normalize description whitespace before saving.
4. Normalize website values to valid `https://...` or `http://...` URLs.
5. Normalize exchange labels to a clean display set such as `NASDAQ`, `NYSE`, and `NYSE American` when possible.
6. Keep curated overrides authoritative over fetched values.
7. Do not touch `facts_updated_at`; metadata freshness is separate from financial-facts freshness.

## Data Quality Targets

After the first full backfill, target:
- `95%+` non-empty `description`
- `95%+` non-empty `website`
- `100%` non-empty `exchange`

Anything below target should be handled with the override CSV, not silent acceptance.

## Verification Plan

Implementation should ship with:
- command tests for single-ticker mode
- tests for override precedence
- tests that blank upstream values do not wipe stored metadata
- tests for URL normalization
- tests for idempotent re-runs

Add a small audit/report command or report output that prints:
- total companies processed
- descriptions filled
- websites filled
- exchanges filled
- remaining blanks by field

## Product Impact

This metadata enrichment improves:
- company header polish
- Overview tab context
- AI business-summary answers

It does not change:
- canonical SEC financial ingestion
- price ingestion
- snapshot computation

## Scheduling

Do not run this as a high-frequency job.

Recommended cadence:
- one-time full backfill when the command lands
- weekly refresh on the worker node
- run after `ingest_companies`, not after `update_prices`

This scheduling should be wired during M7 when cron or `systemd` timers are added.

## Recommended Execution Order

1. Add `enrich_company_metadata`
2. Add `company_metadata_overrides.csv`
3. Run a one-time full backfill locally
4. Audit coverage and fill gaps with overrides
5. Add weekly scheduling in M7
