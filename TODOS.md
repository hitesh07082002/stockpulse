# TODOS — StockPulse

## Pre-Deploy

### CI/CD Pipeline
**What:** Set up GitHub Actions for linting (ruff/eslint), testing (pytest/vitest), and deploy to DigitalOcean App Platform.
**Why:** Clean CI is a resume signal (green badges in README). Also catches regressions before deploy.
**Depends on:** Django project scaffolded, at least one test written.
**Status:** Not started

## Post-Ingestion

### Expand XBRL Mapping Coverage
**What:** After initial ingestion of 500 companies, audit which companies have NULL metrics and expand the `XBRL_METRIC_MAP` with any missing tag variants.
**Why:** Initial mapping covers common tags but some companies may use unusual XBRL tags. You won't know which until you ingest real data.
**Depends on:** `ingest_financials` command working, fixture tests passing.
**Status:** Not started

## Post-V1

### V2 Upgrade Path Documentation
**What:** Document the upgrade path from V1 (structured data + smart pruning) to V2 (RAG with pgvector for cross-company analysis, user auth for watchlists/portfolios).
**Why:** Interview talking point: "Here's what I'd build next and how the architecture supports it." The V1 architecture already supports this — `raw_facts_json` can feed a RAG pipeline, Company model can link to User via a Watchlist model.
**Depends on:** V1 complete.
**Status:** Not started
