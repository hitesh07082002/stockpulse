# StockPulse V1 — Delivery And Hardening Plan

**Prototype:** v1.0.0
**Date:** Mar 22, 2026
**Status:** IN_PROGRESS
**Priority:** P0 — Source-of-truth delivery record and remaining hardening plan
**Depends on:** [DESIGN.md](DESIGN.md)

StockPulse V1 is a public-first stock analysis product for S&P 500 companies with optional user accounts. The product is now live; this document tracks the shipped architecture, milestone record, and the remaining hardening tasks that still matter.

---

## 1.0 Locked Decisions

**Status:** DONE

These decisions are resolved and should not be reopened lightly unless the product itself changes.

**Dimensions:**
- 1.1 DONE V1 is public-first for browsing. Search, company pages, financials, price data, valuation, and screener remain accessible without login.
- 1.2 DONE V1 includes authentication: Google sign-in as the primary path plus email/password fallback.
- 1.3 DONE Launch coverage is the S&P 500. Development and early verification use a smaller seed dataset of 25 companies until normalization and caching are stable.
- 1.4 DONE V1 background work runs as Django management commands triggered by host cron against the app container. Celery and Redis are not part of V1 unless this single scheduled execution path can no longer meet the V1 SLAs of quote refresh within 15 minutes and nightly data jobs within 60 minutes, with misses observed twice in normal operation, or durable user-triggered async jobs become a real product need.
- 1.5 DONE V1 uses the repo's current runtime baseline: Django 6 + Django REST Framework + PostgreSQL 16 on the backend, React 19 + React Router 7 + TanStack Query 5 + Tailwind 4 token layer on the frontend.
- 1.5.1 DONE V1 keeps two charting tools on purpose: `Recharts` for Financials and DCF visuals, and `lightweight-charts` for the Price tab.
- 1.6 DONE Dark mode is the canonical launch theme. Light mode is polish work and not a launch blocker.
- 1.7 DONE The current implementation under `backend/` and `frontend/` is the source of truth. This document now records what shipped plus what still needs polish.

---

## 2.0 Product Scope

**Status:** DONE

StockPulse V1 is a stock research tool, not a brokerage app, social feed, or portfolio manager. The value proposition is trustworthy financial context from SEC data, not feature breadth.

### 2.1 Core Pages

**Status:** DONE

**Dimensions:**
- 2.1.1 DONE `/` is a tool-first landing page with search, a short trust statement, and quick entry points into coverage.
- 2.1.2 DONE `/stock/:ticker` is the hero page with overview, financials, price, valuation, and AI tabs.
- 2.1.3 DONE `/screener` is part of V1.
- 2.1.4 DONE `/about` explains methodology, data sources, and system architecture in plain language.

### 2.2 Core Features

**Status:** DONE

**Dimensions:**
- 2.2.1 DONE Search and discovery across the S&P 500.
- 2.2.2 DONE Historical financial dashboard built from normalized SEC facts.
- 2.2.3 DONE Cached price chart and quote freshness signaling.
- 2.2.4 DONE DCF valuation calculator modeled after Qualtrim's serious-but-approachable workflow, with sector warnings and missing-data guardrails.
- 2.2.5 DONE Filterable screener using precomputed metrics and a focused V1 filter set.
- 2.2.6 DONE Per-company AI copilot grounded primarily in structured StockPulse data, with limited general financial context used when it helps explain the numbers.

### 2.3 Explicitly Out of Scope for V1

**Status:** DONE

**Dimensions:**
- 2.3.1 DONE Watchlists, saved portfolios, and saved chats are out of V1 even though accounts exist.
- 2.3.2 DONE Real-time streaming quotes or WebSocket infrastructure.
- 2.3.3 DONE News feeds, earnings calendars, and macro dashboards.
- 2.3.4 DONE Cross-company RAG, embeddings, pgvector, and document search.
- 2.3.5 DONE Personalized recommendations or brokerage-style alerts.

---

## 3.0 User Experience Contract

**Status:** DONE

The primary user journey is simple and fast:

1. Land on the homepage and search a company.
2. Open the stock detail page and understand the business in under 60 seconds.
3. Inspect historical financial trends, current price context, and valuation.
4. Ask the AI copilot a company-specific question grounded in the same normalized data shown in the UI.

### 3.1 Landing Page

**Status:** DONE

**Dimensions:**
- 3.1.1 DONE No marketing hero and no feature-grid landing page.
- 3.1.2 DONE Search is the dominant action.
- 3.1.3 DONE Quick picks and trust cues replace live market-movers scope for V1.

### 3.2 Stock Detail Page

**Status:** DONE

**Dimensions:**
- 3.2.1 DONE Persistent company header with ticker, company name, sector, quote, and freshness badge.
- 3.2.2 DONE Tabs: Overview, Financials, Price, Valuation, AI.
- 3.2.3 DONE Every tab must render sensible loading, empty, stale, and error states.
- 3.2.4 DONE The Valuation tab pre-fills core DCF assumptions from company data but keeps the major drivers editable.

### 3.3 AI Access Policy

**Status:** DONE

**Dimensions:**
- 3.3.1 DONE AI is visible to all users.
- 3.3.2 DONE Anonymous users get 10 prompts per day per signed session key, with a soft IP backstop.
- 3.3.3 DONE Authenticated users get 50 prompts per day per account.
- 3.3.4 DONE Spend safety is handled operationally through provider credits and model choice, not an in-app daily budget cap.
- 3.3.5 DONE After the anonymous quota is exhausted, the UI offers sign-in for the 50-prompt authenticated allowance that day.
- 3.3.6 DONE Anonymous AI identity is issued as a signed `anon_ai_id` cookie on first copilot use, rotates every 30 days, and is reissued if missing or invalid. Anonymous daily quota enforcement is best-effort: clearing cookies resets the identity. The per-minute IP backstop limits abuse velocity but does not enforce a hard daily cap on anonymous users.
- 3.3.7 DONE A short-window burst limit of 3 prompts per minute per IP applies alongside the daily quotas. This is enforced via middleware rate limiting (e.g. `django-ratelimit`), not via `AIUsageCounter`.
- 3.3.8 DONE The shipped product does not keep an in-app spend ledger; quota enforcement remains product behavior and provider credits remain the operational cost backstop.
- 3.3.9 DONE Provider misconfiguration or exhaustion must surface as an honest unavailable state, not as a fake in-app budget message.

### 3.4 Authentication UX

**Status:** DONE

**Dimensions:**
- 3.4.1 DONE Sign-in entry points exist in the global header and AI tab.
- 3.4.2 DONE Authentication uses modal or drawer flows, not separate marketing-heavy auth pages.
- 3.4.3 DONE Logged-out users can still browse the whole product.
- 3.4.4 DONE Logged-in state is persistent across refresh via secure cookie-based auth.
- 3.4.5 DONE Google sign-in is the primary visible auth action in V1, while email/password remains available as a secondary fallback path.

### 3.5 Screener Contract

**Status:** DONE

**Dimensions:**
- 3.5.1 DONE V1 screener supports a focused filter set: sector, industry, market cap, PE, revenue growth, gross margin, operating margin, debt_to_equity, and a positive free-cash-flow toggle.
- 3.5.2 DONE V1 screener uses a curated default results table and sortable columns rather than a fully customizable terminal-style layout.
- 3.5.3 DONE Saved screens, custom column builders, and complex boolean filter groups are out of V1.

### 3.6 Valuation Contract

**Status:** DONE

**Dimensions:**
- 3.6.1 DONE The valuation tab follows a Qualtrim-like workflow with a toggle between `Earnings` mode and `Cash Flow` mode.
- 3.6.2 DONE Each mode uses three primary user-entered assumptions: growth rate, appropriate terminal multiple, and desired return.
- 3.6.3 DONE The current metric is prefilled from canonical data when available, but remains editable, so the calculator effectively supports three or four inputs.
- 3.6.4 DONE `Earnings` mode centers on EPS-style inputs and a projected earnings multiple outcome.
- 3.6.5 DONE `Cash Flow` mode centers on free-cash-flow-per-share inputs and a projected cash-flow multiple outcome.
- 3.6.6 DONE The primary valuation visual is a 5-year projection chart with summary result cards above it.
- 3.6.7 DONE Sensitivity heatmaps, spreadsheet-grade scenario trees, saved models, and advanced dilution modeling are out of V1.
- 3.6.8 DONE Valuation guardrails: keep the DCF calculator available for financial-sector companies, but show the rough-fit caution in `Cash Flow` mode where simplified cash-flow DCF is weakest for banks, insurers, exchanges, and brokers. Warn on negative trailing earnings or negative trailing FCF. Require `shares_outstanding` to be non-null before enabling Cash Flow mode. Missing or nonsensical inputs produce a clear data-quality warning, not a garbage calculation.

---

## 4.0 Data Model

**Status:** DONE

The shipped schema stays compact and biased toward deterministic read performance.

```text
Company
├── cik (unique)
├── ticker (unique, indexed)
├── name, sector, industry, description
├── exchange, website (optional)
├── current_price, market_cap, shares_outstanding
├── week_52_high, week_52_low
├── quote_updated_at
└── facts_updated_at

FinancialFact
├── company (FK)
├── metric_key
├── period_type ('annual' | 'quarterly')
├── fiscal_year, fiscal_quarter
├── period_start, period_end
├── value
├── unit
├── source_tag
├── source_form
├── filed_date
├── is_amended
├── is_derived
└── selection_reason

MetricSnapshot
├── company (OneToOne)
├── pe_ratio, dividend_yield
├── revenue_growth_yoy
├── gross_margin, operating_margin, net_margin
├── roe, debt_to_equity
├── free_cash_flow
└── computed_at

PriceCache
├── company (FK)
├── range_key ('1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX')
├── data_json
├── sampling_granularity ('daily' | 'weekly' | 'monthly')
├── stale
└── fetched_at

IngestionRun
├── company (nullable FK)
├── source ('companies' | 'sec' | 'prices' | 'snapshots')
├── status ('in_progress' | 'success' | 'failed')
├── details_json
├── started_at
└── completed_at

RawSecPayload
├── company (FK)
├── source ('companyfacts' | 'submissions')
├── status ('success' | 'failed')
├── payload_json
├── fetched_at
└── retention_note

AIUsageCounter
├── usage_key_hash
├── user (nullable FK to auth user)
├── day (America/New_York calendar day)
├── request_count
└── updated_at
```

**Dimensions:**
- 4.1 DONE `FinancialFact` is the canonical normalized layer used by charts, screener metrics, valuation, and AI context.
- 4.2 DONE `MetricSnapshot` stores fast screener and overview metrics so the frontend does not recompute cross-row math.
- 4.3 DONE `PriceCache` stores range responses and stale metadata in PostgreSQL. Cache truth lives in the database, not process memory.
- 4.3.1 DONE Range caches include explicit sampling granularity so long-range payload size is bounded deterministically.
- 4.4 DONE Authentication uses Django's built-in user model plus secure JWT cookie transport.
- 4.5 DONE `AIUsageCounter` supports the V1 daily quotas of 10 anonymous prompts and 50 authenticated prompts without requiring Redis in V1.
- 4.6 DONE AI cost safety is handled operationally through provider credit limits and model selection, not an in-app spend ledger.
- 4.7 DONE There is no in-app daily AI budget table in the shipped product; cost control is external to request handling.
- 4.8 DONE Raw SEC payloads are stored in a separate cold audit model, not on the hot `Company` row.
- 4.9 DONE Raw SEC payload retention is bounded: keep the latest successful payload per `company + source` and the most recent failed payload for debugging.
- 4.10 DONE AI quotas reset on the `America/New_York` calendar day.

---

## 5.0 XBRL Normalization Contract

**Status:** DONE

This section is the heart of the product data contract. If these rules change, downstream charts, metrics, and AI answers change too.

### 5.1 Metric Registry

**Status:** DONE

Every supported metric must be declared in a registry with:

**Dimensions:**
- 5.1.1 DONE `metric_key`
- 5.1.2 DONE metric class: `duration`, `instant`, `per_share`, or `derived`
- 5.1.3 DONE allowed unit family, such as `USD`, `USD/share`, or `shares`
- 5.1.4 DONE preferred SEC tags in priority order
- 5.1.5 DONE whether the metric supports annual, quarterly, or both

Initial V1 metric set:

- revenue
- gross_profit
- operating_income
- net_income
- diluted_eps
- operating_cash_flow
- capital_expenditures
- free_cash_flow
- cash_and_equivalents
- total_debt
- shareholders_equity
- shares_outstanding

### 5.2 Fact Filtering Rules

**Status:** DONE

Before selecting any canonical fact:

**Dimensions:**
- 5.2.1 DONE Reject facts whose units do not match the metric's allowed unit family.
- 5.2.2 DONE Reject segmented facts; V1 uses consolidated company-level facts only.
- 5.2.3 DONE Reject facts without an end date.
- 5.2.4 DONE Keep bounded raw SEC payload history in `RawSecPayload` for debugging and future audits, even when a fact is rejected from canonical selection.

### 5.3 Annual Fact Selection

**Status:** DONE

Annual duration metrics use this precedence:

**Dimensions:**
- 5.3.1 DONE Preferred forms: `10-K`, `10-K/A`, `20-F`, `20-F/A`, `40-F`, `40-F/A`
- 5.3.2 DONE Expected duration window: 330 to 370 days
- 5.3.3 DONE If both original and amended facts exist for the same period, the latest filed fact wins and `is_amended=true`
- 5.3.4 DONE If multiple candidate facts still remain, choose by this ranking:

```text
1. Exact allowed unit match
2. Consolidated non-segment fact
3. Preferred annual form family
4. Duration closest to one fiscal year
5. Newest filed_date
6. Stable deterministic tie-break on source_tag
```

### 5.4 Quarterly Fact Selection

**Status:** DONE

Quarterly duration metrics use this precedence:

**Dimensions:**
- 5.4.1 DONE Preferred forms: `10-Q`, `10-Q/A`
- 5.4.2 DONE Expected duration window: 80 to 100 days
- 5.4.3 DONE If an explicit quarter fact exists, it beats any derived quarter fact.
- 5.4.4 DONE If only year-to-date values are available, Q2 and Q3 may be derived by subtracting the previous YTD value from the current YTD value when both facts share the same unit family and fiscal year.
- 5.4.5 DONE Q4 may be derived as `FY - Q1 - Q2 - Q3` only when the annual fact and the first three quarter facts are canonical and internally consistent.
- 5.4.6 DONE Derived facts are stored with `is_derived=true` and `selection_reason='derived_from_ytd'` or `selection_reason='derived_from_fy'`.
- 5.4.7 DONE If derivation inputs conflict materially, no quarter fact is emitted; V1 prefers a gap to a wrong value.

### 5.5 Instant Fact Selection

**Status:** DONE

For instant metrics such as cash, debt, and equity:

**Dimensions:**
- 5.5.1 DONE Use facts whose instant date matches the selected period end.
- 5.5.2 DONE Annual snapshots prefer annual forms; quarterly snapshots prefer quarter filings.
- 5.5.3 DONE If multiple facts match, use the same unit, amendment, filed date, and deterministic tie-break logic as duration metrics.

### 5.6 Provenance Rules

**Status:** DONE

Every canonical fact must preserve enough provenance to explain why it exists.

**Dimensions:**
- 5.6.1 DONE Persist `source_tag`, `source_form`, `filed_date`, `is_amended`, `is_derived`, and `selection_reason`
- 5.6.2 DONE The frontend can expose provenance later, but the backend must preserve it from day one
- 5.6.3 DONE Normalization tests must prove that amended filings, duplicate facts, and mixed units resolve deterministically

---

## 6.0 Read Architecture

**Status:** DONE

### 6.1 Quote and Price Caching

**Status:** DONE

Price data is cache-first with graceful stale fallback.

**Dimensions:**
- 6.1.1 DONE Current quote cache TTL: 15 minutes
- 6.1.2 DONE `1M`, `3M`, `6M`, `1Y` chart cache TTL: 6 hours
- 6.1.3 DONE `5Y`, `MAX` chart cache TTL: 24 hours
- 6.1.4 DONE If upstream price refresh fails, stale cached data is served with `stale=true` and `fetched_at`
- 6.1.5 DONE The company header quote and Price tab must read from the same cached quote source to prevent mismatch
- 6.1.6 DONE Price range downsampling is fixed by range: `1M`, `3M`, `6M` use daily points, `1Y` uses trading-day points, `5Y` uses weekly points, and `MAX` uses monthly points
- 6.1.7 DONE The default price line uses adjusted close for every range, with no adjusted-vs-raw toggle in V1

### 6.2 Snapshot Computation

**Status:** DONE

`MetricSnapshot` is recomputed from canonical facts and cached quote data.

**Dimensions:**
- 6.2.1 DONE Division-by-zero or missing-input cases produce `NULL`, not fake zeroes
- 6.2.2 DONE Derived metrics must use the newest canonical facts only
- 6.2.3 DONE Screener endpoints query `MetricSnapshot`, not raw `FinancialFact` joins on every request
- 6.2.4 DONE For launch coverage audits, a derived metric counts as covered only when its required canonical inputs exist and snapshot computation produces a non-`NULL` result

### 6.3 AI Context Construction

**Status:** DONE

The AI copilot is grounded primarily in structured StockPulse data, with limited general financial context allowed when it helps explain what the numbers mean.

**Dimensions:**
- 6.3.1 DONE Context includes company metadata, current cached quote, 10 annual periods, 8 recent quarters, and the latest `MetricSnapshot`
- 6.3.2 DONE The prompt frames the model as an analyst interpreting normalized numeric data, not quoting SEC filings
- 6.3.3 DONE If data coverage is sparse, the assistant must say so plainly
- 6.3.4 DONE SSE streaming is part of V1 because it materially improves perceived speed
- 6.3.5 DONE AI access policy checks anonymous or authenticated quota before model invocation
- 6.3.6 DONE Anonymous requests are identified by a signed `anon_ai_id` cookie and still respect the per-minute IP burst limit
- 6.3.7 DONE Each copilot request enforces quota before model invocation. Cost control is handled outside the request path through provider credits and model choice, not an in-app ledger.
- 6.3.8 DONE If the provider is unavailable or misconfigured, the request is denied before any model call is attempted.
- 6.3.9 DONE Daily quota accounting uses the `America/New_York` calendar day, not the requester's local timezone
- 6.3.10 DONE M6 uses a tiny provider seam: one orchestration path with provider-specific adapters at the edge, not provider logic scattered through views or prompts
- 6.3.11 DONE Anthropic is the production-default provider for V1. Gemini may be wired through the same adapter seam for local/dev/staging so low-cost or free development remains possible without changing the core architecture.
- 6.3.12 DONE The context assembler produces structured company data first and only renders provider-specific prompt/input text at the edge
- 6.3.13 DONE The structured AI context is limited to company metadata, quote freshness, current `MetricSnapshot`, 10 annual periods, 8 recent quarters, and explicit sparse-data / coverage signals. It does not dump raw SEC payloads or filing text into prompts.
- 6.3.14 DONE V1 streaming stays on SSE over standard Django streaming responses. No WebSocket-specific AI transport is introduced in M6.
- 6.3.15 DONE The canonical client-facing stream schema is provider-agnostic and limited to `meta`, `text`, `error`, and `done` events. Provider-native token or delta events are translated at the adapter boundary.
- 6.3.16 DONE SSE frames are emitted as JSON `data:` records with a `type` field (`meta`, `text`, `error`, `done`) so the frontend can use `fetch` streaming without provider-specific parsing rules.
- 6.3.17 DONE The structured context payload is organized into stable sections: `identity`, `freshness`, `snapshot`, `annual_series`, `quarterly_series`, and `coverage`, so groundedness tests can assert the exact inputs independent of provider prompt wording.
- 6.3.18 DONE `meta` carries request-level context only: ticker, company name, quote freshness, coverage/sparsity summary, and remaining daily quota when available. `text` carries incremental assistant text, `error` carries a safe user-facing code/message, and `done` closes the stream.
- 6.3.19 DONE V1 copilot supports bounded ephemeral follow-up context: the current message plus up to the 6 most recent prior turns from the active browser session. No server-side conversation persistence or saved chats are added.
- 6.3.20 DONE Provider selection is environment-configured and stable for the lifetime of a request. V1 does not auto-fail over between Anthropic and Gemini mid-request.
- 6.3.21 DONE The AI request path stays performance-bounded: one company/snapshot load plus bounded annual and quarterly fact queries. Prompt/context assembly must not grow with full filing history or arbitrary metric dumps.
- 6.3.22 DONE Failure handling is explicit: invalid input, quota exhaustion, provider unavailable, timeout, and interrupted stream all map to honest user-facing errors. If text has already streamed, the partial answer may remain visible, but the stream must still terminate with a final `error` or `done` frame.
- 6.3.23 DONE User prompts are untrusted input. The assistant may reason only over the structured StockPulse context for the requested ticker and must not imply access to raw filing text, hidden data, or future prices.

### 6.4 Authentication Architecture

**Status:** DONE

Authentication is part of V1, but it stays narrow and boring.

**Dimensions:**
- 6.4.1 DONE Backend uses Django auth + `djangorestframework-simplejwt`
- 6.4.2 DONE Google OAuth uses `django-allauth` with a backend-managed redirect/callback flow and is required in V1
- 6.4.3 DONE JWTs are stored in `httpOnly` cookies, not localStorage
- 6.4.4 DONE CSRF protection remains enabled for state-changing requests
- 6.4.5 DONE Authentication exists to support higher AI limits and future user-owned features without gating browsing
- 6.4.6 DONE The refresh endpoint reads the refresh cookie server-side; the frontend never stores or posts a refresh token body
- 6.4.7 DONE `GET /api/auth/session/` exposes whether a refresh cookie is present so the frontend only attempts silent refresh when a real refresh session exists
- 6.4.8 DONE Google sign-in is treated as the primary V1 entry path, while email/password remains supported for fallback and recovery cases
- 6.4.9 DONE Account linking policy: if a Google sign-in email matches an existing email/password account, the social account is auto-linked to the existing user via `django-allauth` email authentication. No duplicate accounts are created for the same verified email.

---

## 7.0 API Surface

**Status:** DONE

```text
POST /api/auth/register/
     { email, password, name }

POST /api/auth/login/
     { email, password }

GET  /api/auth/session/

GET  /api/auth/google/start/

GET  /api/auth/google/callback/

POST /api/auth/refresh/
     {}
     refresh cookie only

POST /api/auth/logout/

GET  /api/companies/
     ?search=apple
     ?sector=Information%20Technology
     ?page=1

GET  /api/companies/{ticker}/

GET  /api/companies/{ticker}/financials/
     ?metrics=revenue,net_income,free_cash_flow
     ?period_type=annual|quarterly
     ?start_year=2014

GET  /api/companies/{ticker}/prices/
     ?range=1M|3M|6M|1Y|5Y|MAX

GET  /api/companies/{ticker}/valuation-inputs/

GET  /api/screener/
     ?sector=Information%20Technology
     ?pe_min=5
     ?pe_max=30
     ?market_cap_min=10000000000
     ?sort=market_cap
     ?order=desc

POST /api/companies/{ticker}/copilot/
     { "message": "Why did margins fall in 2022?" }
```

**Dimensions:**
- 7.1 DONE Browsing endpoints are public.
- 7.2 DONE Auth endpoints exist for registration, login, backend-managed Google sign-in start/callback, cookie-based refresh, and logout.
- 7.3 DONE Price responses include cache freshness metadata.
- 7.4 DONE Financial responses expose only canonical normalized facts.
- 7.5 DONE Copilot responses must enforce anonymous or authenticated quota before invoking the model.

---

## 8.0 Build Sequence

**Status:** IN_PROGRESS

Delivery happened in vertical slices, not repo cleanup tasks, and the remaining hardening work should keep that same discipline.

### 8.0.1 Migration Record

**Status:** DONE

These notes capture how the delivered V1 replaced the earlier repo state without carrying unnecessary compatibility baggage.

**Dimensions:**
- 8.0.1.1 DONE Preserve major pre-launch states in Git history before invasive replacement work begins.
- 8.0.1.2 DONE Replace the product in the active repository through dedicated feature branches and verified merges rather than by switching the default branch early.
- 8.0.1.3 DONE Because the product was still pre-launch during the rebuild, no milestone added backward-compatibility shims solely to mirror earlier unreleased behavior.
- 8.0.1.4 DONE Do not keep a long-lived parallel legacy app or duplicate frontend/backend tree on `main`; that would create drift, agent confusion, and extra maintenance cost.
- 8.0.1.5 DONE Existing code may be consulted for ideas, mappings, fixtures, and operational lessons, but old component boundaries, endpoints, and abstractions are not treated as architecture constraints.
- 8.0.1.6 DONE Replace the product milestone by milestone; once a new slice is real and verified, remove or supersede the old slice instead of maintaining both implementations in parallel.
- 8.0.1.7 DONE Reuse is selective and explicit: keep only what still earns its place, such as data mappings, representative fixtures, or source lists, and rebuild the rest against the new contracts in this plan.

### 8.1 M1 — Foundation

**Status:** DONE

**Dimensions:**
- 8.1.1 DONE Replace ad hoc scripts with standard repo entry points: `make dev`, `make lint`, `make test`, `make build`
- 8.1.2 DONE Add backend pytest, frontend vitest, and Playwright smoke coverage
- 8.1.3 DONE Create seed fixtures for 25 representative companies across sectors
- 8.1.4 DONE Add normalization fixture tests before building the UI
- 8.1.5 DONE Add GitHub Actions CI with required PR checks for backend lint/tests, frontend lint/tests/build, and Playwright smoke

### 8.2 M2 — Ingestion and Canonical Data

**Status:** DONE

Current checkpoint:
- the local database has been rebuilt from the canonical pipeline for the full 500-company universe, using company-level dedupe by unique CIK
- the canonical pipeline now has live SEC facts, bounded raw payload retention, current quotes, and `MetricSnapshot` rows for all 500 companies
- canonical facts can be replayed from retained `RawSecPayload` rows with `ingest_financials --from-cache --force`, so full-universe rebuilds no longer depend on live SEC availability
- the launch coverage audit artifact exists at `docs/audits/sp500-launch-coverage-2026-03-22.md` and now passes the `95%+` gate
- `gross_profit` and `gross_margin` are audited conditionally, only for issuers whose retained SEC payloads expose a comparable gross-profit or cost-of-revenue concept

Locked execution decisions:
- hard-cut to the final canonical schema now; do not extend the legacy model shape
- treat local and dev data as disposable; reset and rebuild after the schema cut
- do not add compatibility glue for unreleased local data
- build an explicit metric registry before live SEC ingestion work
- persist raw SEC payloads in `RawSecPayload`, not on `Company`
- replace `StockMetrics` with `MetricSnapshot`
- replace `compute_metrics` with `compute_snapshots`
- treat the S&P 500 coverage audit as a real M2 artifact, not a launch-week manual task

Implementation order:
1. cut the schema to the final canonical models
2. build the metric registry
3. prove normalization deterministically against fixtures
4. persist raw SEC payloads and ingestion runs
5. rebuild `ingest_companies`
6. rebuild `ingest_financials`
7. build `compute_snapshots`
8. reset local/dev data and rebuild from the new pipeline
9. expand from the 25-company seed to the full S&P 500
10. record the launch coverage audit

**Dimensions:**
- 8.2.1 DONE Hard-cut to the final canonical schema: `FinancialFact`, `MetricSnapshot`, `RawSecPayload`, `IngestionRun`, and `PriceCache`
- 8.2.2 DONE Build the metric registry and prove deterministic normalization with fixture-based tests for amended filings, mixed units, and derived quarters
- 8.2.3 DONE Persist bounded raw SEC payloads in `RawSecPayload`, rebuild `ingest_companies`, and rebuild `ingest_financials` against the canonical schema
- 8.2.4 DONE Replace legacy `compute_metrics` with `compute_snapshots` on top of canonical facts only
- 8.2.5 DONE Expand from the rebuilt 25-company development seed set to full S&P 500 coverage and record the launch coverage audit at `95%+` launch-critical metric coverage; the full-universe rebuild, cached replay path, and passing audit artifact are landed
- 8.2.6 DONE M2 includes basic quote refresh (`update_prices`) that populates `Company` quote fields (`current_price`, `market_cap`, `quote_updated_at`, etc.) and feeds `MetricSnapshot` computation. This is sufficient for the M3 company header. The full `PriceCache` range system (range-keyed blobs, TTLs, stale fallback, downsampling) is built in M4.

### 8.3 M3 — Public Read APIs and Stock Detail Shell

**Status:** DONE

**Dimensions:**
- 8.3.1 DONE Company list, company detail, and financials endpoints are landed and hardened for search, pagination, 404s, and empty responses
- 8.3.2 DONE Landing search and the stock detail shell are landed with the approved hierarchy, search-first flow, quote freshness, and mobile tab treatment
- 8.3.3 DONE Overview and Financials now read from canonical company detail, snapshot, and financial facts data instead of legacy assumptions
- 8.3.4 DONE Loading, empty, error, and no-data states ship with the first usable landing -> stock detail -> Financials slice
- 8.3.5 DONE Required tests pass: API endpoint tests for company list/detail/financials, frontend unit tests for loading/empty/error states, and Playwright smoke for landing -> search -> stock detail -> Financials tab

### 8.4 M4 — Price, Valuation, and Screener

**Status:** DONE

**Dimensions:**
- 8.4.1 DONE Build quote and price cache flows
- 8.4.2 DONE Build Price tab with stale fallback
- 8.4.3 DONE Build valuation inputs and a Qualtrim-style DCF calculator
- 8.4.4 DONE Build the focused V1 screener on top of `MetricSnapshot`
- 8.4.5 DONE Required tests: API endpoint tests for prices (each range + stale fallback), valuation-inputs, screener (filters + sort + empty); unit tests for valuation guardrails (financial-sector caution, negative earnings, negative FCF, missing shares_outstanding); Playwright smoke for price tab range selector and screener filter-to-company flow

### 8.5 M5 — Authentication

**Status:** DONE

**Dimensions:**
- 8.5.1 DONE Built auth endpoints, secure cookie flow, `/api/auth/session/`, and auth context on the frontend
- 8.5.2 DONE Built a Google-first auth modal with email/password fallback in the global shell and AI tab
- 8.5.3 DONE Added auth tests for registration, login, refresh, logout, and backend-managed Google callback flow
- 8.5.4 DONE Required tests: API tests for register, login, refresh, logout, Google callback (new user + existing email auto-link); unit test for account auto-link by verified email; Playwright smoke for auth modal flow and Google sign-in end to end

### 8.6 M6 — AI Copilot

**Status:** DONE

**Dimensions:**
- 8.6.1 DONE M6 is implemented in two internal workstreams: `M6A core copilot pipeline` and `M6B quota/upgrade UX`
- 8.6.2 DONE `M6A` builds one thin API/view layer, one copilot orchestration service, one provider adapter seam, and a structured context assembler sourced from `Company`, `FinancialFact`, `MetricSnapshot`, and cached quote data
- 8.6.3 DONE `M6A` includes the real backend enforcement path from day one: signed anonymous identity, 10-anonymous / 50-authenticated quota enforcement via `AIUsageCounter`, burst backstop, and honest SSE / error responses
- 8.6.4 DONE `M6A` ships SSE streaming with a small canonical event schema (`meta`, `text`, `error`, `done`), keeping provider-specific event differences out of the frontend
- 8.6.5 DONE `M6B` focuses on frontend upgrade UX, anonymous quota exhaustion -> sign-in continuation, richer empty/error states, and non-critical AI polish
- 8.6.6 DONE `M6A` carries bounded follow-up history from the active client session without adding saved conversations or server-side chat persistence
- 8.6.7 DONE `M6A` enforces config-driven provider selection, bounded query/prompt assembly, and explicit timeout / interrupted-stream handling
- 8.6.8 DONE Prompt and response tests cover groundedness and sparse-data honesty through the structured-context contract and provider event normalization
- 8.6.9 DONE Required tests pass: API tests for copilot (anonymous quota, authenticated quota, burst limit, SSE streaming); unit tests for context assembly correctness, bounded follow-up history, provider event normalization, prompt structure, sparse context handling, and provider timeout; Playwright smoke for AI tab prompt submit and quota exhaustion -> sign-in upgrade flow

### 8.6.10 M6 Post-Review Simplification

**Status:** DONE

Eng review (Mar 23, 2026) with Codex outside voice identified simplification and quality improvements. These land as a pre-M7 cleanup pass.

**Dimensions:**
- 8.6.10.1 DONE Switch default Anthropic model to `claude-haiku-4-5`, while keeping `ANTHROPIC_MODEL` configurable for overrides such as Sonnet.
- 8.6.10.2 DONE Remove `AIBudgetDay` and all reserve/reconcile budget logic. Quota system (`AIUsageCounter`) remains and enforces 10 anonymous / 50 authenticated requests per day, with the 3/minute IP burst limit still in place.
- 8.6.10.3 DONE Rewrite the system prompt for output quality: analysis framework, more natural analyst voice, markdown structure, and explicit anti-speculation guardrails.
- 8.6.10.4 DONE Relax strict DB-only grounding: the copilot uses StockPulse data as its primary source but may use general financial knowledge to explain why the numbers matter, while still distinguishing product data from general explanation.
- 8.6.10.5 DONE Trim context assembly: remove the 2x over-fetch multiplier, drop null values from the serialized context, and compact prompt payloads.
- 8.6.10.6 DONE Render richer AI markdown safely without the brittle bare-package import path that broke Vite dev resolution.
- 8.6.10.7 DONE Update tests for the simplified AI path: remove dead budget assertions, add prompt/context coverage, sparse-context coverage, authenticated quota coverage, provider timeout coverage, and Haiku default coverage.
- 8.6.10.8 DONE Update `spec.md`, `architecture.md`, and `feature.md` to reflect grounding and budget changes.

### 8.7 M7 — Hardening and Deploy

**Status:** IN_PROGRESS

**Dimensions:**
- 8.7.1 DONE Add host-cron execution for management commands
- 8.7.2 DONE Add production settings, health checks, and deployment configuration
- 8.7.3 IN_PROGRESS Complete accessibility, responsive, and performance polish
- 8.7.4 DONE Update README and core docs with setup, architecture, verification, and deploy guidance
- 8.7.5 DONE Add direct production deploy from `main`, automated migrations, health checks, and documented rollback steps
- 8.7.6 IN_PROGRESS Required tests: operational timing verification for scheduled job SLAs, production deployment verification, and health check endpoint coverage

---

## 9.0 Verification Gates

**Status:** IN_PROGRESS

No milestone is complete without passing its verification gate. Gates are cumulative: each milestone inherits all gates from prior milestones.

### 9.1 M1–M2 Gates (Foundation + Ingestion)

- 9.1.1 DONE `make lint` passes
- 9.1.2 DONE `make test` passes
- 9.1.3 DONE `make build` passes
- 9.1.4 DONE Normalization fixtures prove deterministic handling of duplicates, amendments, mixed units, and derived quarters
- 9.1.5 DONE Launch coverage audit passes 95%+ gate
- 9.1.6 DONE Required GitHub Actions checks pass on pull requests

### 9.2 M3 Gates (Public Read APIs + Stock Detail Shell)

- 9.2.1 DONE Playwright smoke: landing -> search -> stock detail -> Financials tab renders canonical data
- 9.2.2 DONE API endpoint tests: company list/detail/financials (happy path, 404, empty, pagination)
- 9.2.3 DONE Frontend unit tests: loading/empty/error states on landing-adjacent and stock-detail surfaces

### 9.3 M4 Gates (Price, Valuation, Screener)

- 9.3.1 DONE API endpoint tests: prices (each range + stale), valuation-inputs, screener (filters + sort + empty)
- 9.3.2 DONE Valuation guardrail tests: financial-sector caution, negative earnings warning, negative FCF warning, missing shares_outstanding
- 9.3.3 DONE Playwright smoke: price tab range selector, screener filter-to-company flow

### 9.4 M5 Gates (Authentication)

- 9.4.1 DONE Auth API tests: register, login, refresh, logout, Google callback (new user, existing email auto-link)
- 9.4.2 DONE Auth flow smoke: register/login/logout end to end
- 9.4.3 DONE Google sign-in smoke coverage passes end to end

### 9.5 M6 Gates (AI Copilot)

- 9.5.1 DONE Quota enforcement tests pass: anonymous quota, authenticated quota, and burst limit
- 9.5.2 DONE Context assembly tests pass: stable `identity` / `freshness` / `snapshot` / `annual_series` / `quarterly_series` / `coverage` sections, bounded annual+quarterly windows, bounded recent-turn history, and sparse-data honesty
- 9.5.3 DONE Provider adapter tests pass: Anthropic and Gemini responses normalize into the canonical `meta` / `text` / `error` / `done` stream contract without leaking provider-native event shapes to the frontend
- 9.5.4 DONE Failure-mode tests pass: invalid JSON, empty prompt, oversized prompt, unknown ticker, provider unavailable, provider timeout, and interrupted stream semantics
- 9.5.5 DONE Playwright smoke: AI tab prompt submit with streaming response and visible quota state
- 9.5.6 DONE Anonymous AI quota exhaustion -> sign-in -> authenticated allowance upgrade flow passes end to end

### 9.6 M7 Gates (Hardening + Deploy)

- 9.6.1 PENDING Operational timing proves quote refresh completes within 15 minutes and nightly ingestion or snapshot jobs complete within 60 minutes on normal V1 load
- 9.6.2 DONE Direct production deployment from `main` proves immutable artifact delivery, automated migration, and post-deploy health verification
- 9.6.3 PENDING Protected-branch rules keep `main` merge-safe

---

## 10.0 Acceptance Criteria

**Status:** IN_PROGRESS

- [x] 10.1 Any S&P 500 company in scope can be searched and opened from the public landing page
- [x] 10.2 Core financial metrics render from canonical normalized SEC data
- [x] 10.3 Quote and price chart data use shared cached sources and expose freshness clearly
- [x] 10.4 Screener performance is driven by `MetricSnapshot`, not heavy request-time joins
- [x] 10.5 AI copilot answers per-company questions and bounded follow-up turns using structured StockPulse data as primary grounding, uses general financial knowledge only as explanatory context, and admits uncertainty when coverage is thin
- [x] 10.6 Users can register, log in, refresh auth state, and sign in with Google using secure cookie-based auth
- [x] 10.7 AI quotas enforce 10 anonymous prompts per day and 50 authenticated prompts per day
- [x] 10.8 The product is responsive, keyboard-usable, and visually consistent with `DESIGN.md`
- [x] 10.9 The repo has green lint, test, build, and smoke gates
- [x] 10.10 A documented S&P 500 coverage audit exists before launch, shows at least 95% coverage for the full launch-critical metric set, and calls out known gaps explicitly.
Current status: the audit artifact at `docs/audits/sp500-launch-coverage-2026-03-22.md` passes the gate. `gross_profit` and `gross_margin` are evaluated only where retained SEC payloads expose a comparable gross-profit or cost-of-revenue concept.
- [ ] 10.11 The scheduled job model meets the documented V1 timing SLAs, or the plan is explicitly revised before launch
- [x] 10.12 Google sign-in and anonymous-to-authenticated AI upgrade flows are explicitly covered by launch smoke tests
- [ ] 10.13 CI protects `main` with required backend, frontend, and smoke checks
- [x] 10.14 CD supports direct production deployment from `main`, automated migrations, and documented rollback

Launch-critical metric set for 10.10:
- revenue
- gross_profit
- operating_income
- net_income
- free_cash_flow
- cash_and_equivalents
- total_debt
- shares_outstanding
- revenue_growth_yoy
- gross_margin
- operating_margin
- net_margin

For 10.10, derived metrics in the launch-critical set count as covered only when their required canonical inputs exist and the derived result is non-`NULL`. `gross_profit` and `gross_margin` are conditional launch metrics rather than universal ones.

---

## 11.0 Out of Scope

- Saved conversations
- Live market movers on the landing page
- Real-time quote streaming
- Portfolio tracking and watchlists
- News, earnings, and macro overlays
- Cross-company RAG or vector search

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Adversarial | `/codex review` | Independent 2nd opinion | 1 | ISSUES_FOUND | 10 findings, 3 accepted (grounding, budget math, remark-gfm), 7 overridden by user |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 3 | CLEAR | M6 simplification: 8 decisions, Haiku default, budget removal, prompt rewrite, context trim |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL) | score: 7/10 → 9/10, 6 decisions |

- **CODEX (outside voice, Mar 23):** 10 findings. Caught: missing `remark-gfm` (accepted), cookie-reset budget bypass math (acknowledged — user controls spend via API key credits), strict grounding contract break (user override — wants general knowledge). Overridden: strategic priority (user wants prompt work before M7), budget removal (API key credit limit is the real cap).
- **UNRESOLVED:** 0
- **VERDICT:** ENG + DESIGN CLEARED — M6.10 simplification ready for implementation, then M7.
