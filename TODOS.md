# TODOS — StockPulse

## Pre-Deploy

### SEC Fair-Access Compliance
**What:** Ensure `ingest_financials` and `ingest_companies` respect the SEC EDGAR 10 requests/second fair-access policy with appropriate throttling and a compliant `User-Agent` header.
**Why:** Unthrottled requests to SEC EDGAR for 500 companies can trigger IP blocks. The SEC publishes fair-access guidelines that require a descriptive User-Agent and rate limiting. Compliance is both practical (avoid blocks) and professional (demonstrates awareness of external API contracts).
**Depends on:** Nothing — can be verified against existing M2 pipeline code.
**Status:** Not started

### Company Metadata Enrichment
**What:** Enrich Company records with `description`, `website`, and `exchange` from a secondary source (e.g., yfinance `.info` or a curated CSV). Currently these fields are blank for most companies.
**Why:** The Overview tab and company header benefit from having company descriptions and exchange info. Blank bios are a poor UX for a portfolio project demonstrating product polish. Not a launch blocker but should land before M7 hardening.
**Depends on:** M3 stock detail shell (so you can see the impact).
**Status:** Not started

## Post-V1

### V2 Upgrade Path Documentation
**What:** Document the upgrade path from V1 (structured data + smart pruning) to V2 (RAG with pgvector for cross-company analysis, user-owned watchlists/portfolios).
**Why:** Interview talking point: "Here's what I'd build next and how the architecture supports it." The V1 architecture already supports this — `RawSecPayload` can feed a RAG pipeline, Company model can link to User via a Watchlist model.
**Depends on:** V1 complete.
**Status:** Not started
