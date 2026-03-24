# TODOS — StockPulse

## Pre-Deploy

### First Production Rollout Verification
**What:** Confirmed production rollout from `main`, plus live verification of health, landing/search, stock detail, auth, AI, and cron-backed data refresh behavior on the real domain.
**Why:** This was the last serious launch gate. It is now complete and should remain documented as the baseline production verification pass.
**Depends on:** Production server setup, GitHub Actions deploy secrets, and a green PR merge to `main`.
**Status:** Done

### Protect `main` With Required Checks
**What:** Turn on GitHub branch protection for `main` and require backend, frontend, and Playwright smoke checks before merge.
**Why:** The CI pipeline is in place, but the repo is not fully launch-safe until `main` is protected from unverified merges.
**Depends on:** CI staying green on the current rewrite branch.
**Status:** Not started

### SEC Fair-Access Verification
**What:** Add explicit regression coverage and an operator note for the existing SEC EDGAR fair-access contract in `ingest_financials`: descriptive `User-Agent`, `0.1s` request interval, and 429 backoff handling.
**Why:** The core behavior is already implemented, but it is only partially proven in tests today, and the current TODO incorrectly implies `ingest_companies` talks to SEC when it actually reads the local S&P universe CSV.
**Depends on:** Existing `ingest_financials` command behavior in [`backend/stocks/management/commands/ingest_financials.py`](./backend/stocks/management/commands/ingest_financials.py).
**Status:** Not started

### Metadata Override Curation
**What:** Curate the small residual override set for `description`, `website`, and `exchange` after the first automated metadata backfill. Current known gap: `FISV`.
**Why:** The enrichment command is landed, but the last few low-quality or missing Yahoo records should be fixed in the tracked override CSV so the product reaches effectively complete metadata coverage.
**Plan:** See [`docs/company-metadata-ingestion-plan.md`](./company-metadata-ingestion-plan.md).
**Depends on:** `enrich_company_metadata` being in place and run at least once.
**Status:** Not started

## Post-V1

### V2 Upgrade Path Documentation
**What:** Document the upgrade path from V1 (structured data + smart pruning) to V2 (RAG with pgvector for cross-company analysis, user-owned watchlists/portfolios).
**Why:** Interview talking point: "Here's what I'd build next and how the architecture supports it." The V1 architecture already supports this — `RawSecPayload` can feed a RAG pipeline, Company model can link to User via a Watchlist model.
**Depends on:** V1 complete.
**Status:** Not started
