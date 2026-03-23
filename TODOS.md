# TODOS — StockPulse

## Pre-Deploy

### First Production Rollout Verification
**What:** Finish the first real production rollout from `main`, then verify health, landing/search, stock detail, auth, AI, and cron-backed data refresh behavior on the live domain.
**Why:** M7 deployment infrastructure is implemented, but the live rollout and operator verification pass are still the last serious launch gate.
**Depends on:** Production server setup, GitHub Actions deploy secrets, and a green PR merge to `main`.
**Status:** Not started

### Protect `main` With Required Checks
**What:** Turn on GitHub branch protection for `main` and require backend, frontend, and Playwright smoke checks before merge.
**Why:** The CI pipeline is in place, but the repo is not fully launch-safe until `main` is protected from unverified merges.
**Depends on:** CI staying green on the current rewrite branch.
**Status:** Not started

### SEC Fair-Access Compliance
**What:** Ensure `ingest_financials` and `ingest_companies` respect the SEC EDGAR 10 requests/second fair-access policy with appropriate throttling and a compliant `User-Agent` header.
**Why:** Unthrottled requests to SEC EDGAR for 500 companies can trigger IP blocks. The SEC publishes fair-access guidelines that require a descriptive User-Agent and rate limiting. Compliance is both practical (avoid blocks) and professional (demonstrates awareness of external API contracts).
**Depends on:** Nothing — can be verified against existing M2 pipeline code.
**Status:** Not started

### Metadata Override Curation
**What:** Curate the small residual override set for `description`, `website`, and `exchange` after the first automated metadata backfill. Current known gap: `FISV`.
**Why:** The enrichment command is landed, but the last few low-quality or missing Yahoo records should be fixed in the tracked override CSV so the product reaches effectively complete metadata coverage.
**Plan:** See [`docs/company-metadata-ingestion-plan.md`](./docs/company-metadata-ingestion-plan.md).
**Depends on:** `enrich_company_metadata` being in place and run at least once.
**Status:** Not started

## Post-V1

### V2 Upgrade Path Documentation
**What:** Document the upgrade path from V1 (structured data + smart pruning) to V2 (RAG with pgvector for cross-company analysis, user-owned watchlists/portfolios).
**Why:** Interview talking point: "Here's what I'd build next and how the architecture supports it." The V1 architecture already supports this — `RawSecPayload` can feed a RAG pipeline, Company model can link to User via a Watchlist model.
**Depends on:** V1 complete.
**Status:** Not started
