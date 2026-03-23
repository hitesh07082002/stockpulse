# StockPulse Architecture

**Status:** Drafted from the final V1 plan  
**Date:** Mar 22, 2026  
**Source docs:** [`spec.md`](./spec.md), [`plan.md`](./plan.md), [`DESIGN.md`](./DESIGN.md), [`cicd.md`](./cicd.md)

## Goal

StockPulse V1 is a public-first stock research application. The system is optimized for a clear read path:

1. ingest and normalize SEC financial data
2. cache price context and derived metrics
3. serve a fast stock detail experience
4. layer AI explanation on top of the same structured data

The architecture is intentionally boring in V1: PostgreSQL-backed truth, Django APIs, React frontend, scheduled jobs, no Celery/Redis, no vector search, no real-time streaming quotes.

## Architecture Principles

- PostgreSQL is the source of truth for application data and cache state.
- SEC normalization correctness matters more than job orchestration sophistication.
- Public browsing stays open; auth only adds quota and future user-owned features.
- AI is a product layer over existing data, with StockPulse facts as primary grounding and general financial knowledge used only to explain or contextualize those facts.
- Prefer deterministic batch jobs and read models over expensive request-time computation.

## High-Level System

```text
                        ┌───────────────────────────┐
                        │         React 19          │
                        │  landing / stock / AI UI  │
                        └─────────────┬─────────────┘
                                      │ HTTPS
                        ┌─────────────▼─────────────┐
                        │     Django 6 + DRF        │
                        │ auth / companies / AI API │
                        └───────┬─────────┬─────────┘
                                │         │
                     reads/writes│         │model calls
                                │         ▼
                    ┌───────────▼───┐   Anthropic API
                    │ PostgreSQL 16 │
                    │ app + cache   │
                    └───────┬───────┘
                            │
                            │ scheduled management commands
                            ▼
         ┌────────────────────────────────────────────────────┐
         │ ingest_companies / ingest_financials /            │
         │ compute_snapshots / update_prices                 │
         └───────────────┬───────────────────────┬───────────┘
                         │                       │
                         ▼                       ▼
                    SEC EDGAR                yfinance
```

## Core Subsystems

### 1. Ingestion and Normalization

This is the heart of the product.

```text
SEC company list ───────► ingest_companies ───────► Company

SEC XBRL facts ─────────► ingest_financials
                               │
                               ├─ normalize tags
                               ├─ resolve units
                               ├─ prefer amended/latest facts
                               ├─ derive quarters when needed
                               ▼
                           FinancialFact

FinancialFact + quotes ──► compute_snapshots ─────► MetricSnapshot
```

Responsibilities:
- maintain canonical normalized financial facts
- keep provenance on every selected fact
- retain bounded raw SEC payloads in a cold audit store for debugging and future audits
- generate fast screener and overview read models

Current metadata limitation:
- `ingest_companies` currently loads the company universe from the curated S&P 500 CSV using only `ticker`, `name`, `sector`, `industry`, and `cik`
- `description`, `website`, and `exchange` are not broadly enriched yet, so blank company bios are expected in the current rewrite state
- fixing that requires a separate metadata-enrichment path; it is not part of the SEC financial normalization pipeline

M2 execution rules:
- start with a schema-first hard cut to `FinancialFact`, `MetricSnapshot`, `RawSecPayload`, `IngestionRun`, and `PriceCache`
- build the metric registry before live SEC ingestion work
- keep raw SEC payloads in `RawSecPayload`, never on `Company`
- support deterministic canonical rebuilds from retained raw SEC payloads with `ingest_financials --from-cache --force`
- replace legacy `StockMetrics` and `compute_metrics` with `MetricSnapshot` and `compute_snapshots`
- reset and rebuild local/dev data after the schema cut; do not write compatibility glue for unreleased local data
- treat the S&P 500 coverage audit as an M2 deliverable
- evaluate `gross_profit` and `gross_margin` only where retained SEC payloads expose a comparable gross-profit or cost-of-revenue concept

### 2. Price and Quote Cache

Price data is not treated as live truth. It is a cached supporting surface.

```text
yfinance ──► update_prices ──► Company quote fields
                  │
                  └─ prices endpoint fills / refreshes PriceCache by range
                                          │
                                          └─ stale metadata exposed to UI
```

Responsibilities:
- keep company header quote fields fresh on a scheduled cadence
- serve range-based price charts quickly
- serve adjusted-close trend lines by default for research-oriented price context
- surface freshness clearly
- bound long-range payload size with deterministic downsampling by range
- fall back to stale data instead of failing silently

Current M4 behavior:
- `update_prices` maintains `Company.current_price`, `market_cap`, `week_52_high`, `week_52_low`, `shares_outstanding`, and `quote_updated_at`
- `/api/companies/:ticker/prices` reads through `PriceCache`
- on cache miss or expired cache, the endpoint refreshes that range from `yfinance`, stores it in `PriceCache`, and returns the cached payload
- if the refresh fails but an older cached range exists, the stale cached payload is served with `stale=true`
- range downsampling is fixed by contract: short ranges stay daily or trading-day, `5Y` is weekly, and `MAX` is monthly

### 3. Public Read APIs

Read APIs exist for:
- company list and search
- company detail
- normalized financial series
- cached prices
- valuation inputs
- screener

Design rules:
- public browsing endpoints stay open
- screener reads `MetricSnapshot`, not raw fact joins
- financial endpoints expose canonical values only
- financial and valuation visuals use dashboard-style charts, while the dedicated price surface uses a separate market-chart library
- valuation inputs support two calculator modes: `Earnings` and `Cash Flow`, where `Cash Flow` uses free cash flow per share
- screener sorting and filtering are server-driven for the focused V1 surface, not client-side over the full universe

### 4. Authentication

Auth is intentionally narrow in V1.

```text
email/password ─┐
                ├─► Django auth + allauth + simplejwt
Google redirect ─┘
                         │
                         ├─ access cookie
                         └─ refresh cookie
```

Rules:
- browsing is public
- Google sign-in is the primary V1 auth path, with email/password available as fallback
- Google auth is backend-managed redirect/callback, not a frontend token-post flow
- JWTs live in `httpOnly` cookies
- refresh is cookie-based; the frontend does not store refresh tokens
- frontend shell state bootstraps from `GET /api/auth/session/`, which also seeds the CSRF cookie used by state-changing auth requests and includes whether a refresh cookie is present so anonymous sessions do not generate noisy failed refresh calls
- local development may use a debug-only mock Google consent page when real Google OAuth credentials are absent; production never uses that harness

### 5. AI Copilot

The AI layer starts from structured StockPulse data and may add general financial knowledge when it helps explain what the numbers mean.

```text
user prompt
   │
   ├─ check signed anon cookie or authenticated user
   ├─ enforce daily quota
   ├─ enforce burst limit
   ├─ assemble company context
   ├─ render provider-specific prompt/input at the edge
   ▼
provider adapter call (streaming)
   │
   └─ stream answer to UI
```

Context inputs:
- company metadata
- cached quote
- latest `MetricSnapshot`
- 10 annual periods
- 8 recent quarters
- explicit coverage/sparsity signals

Provider contract:
- Anthropic Haiku 4.5 is the production-default model, with `ANTHROPIC_MODEL` available for overrides such as Sonnet
- Gemini can be used in local/dev/staging through the same adapter seam
- Gemini copilot requests default to a zero thinking budget on this grounded V1 path so hidden reasoning does not consume the visible answer budget
- the frontend only sees canonical SSE JSON frames: `meta`, `text`, `error`, `done`
- provider-native event formats stay behind the adapter boundary

Conversation scope:
- bounded follow-up context comes from the active browser session
- no server-side chat persistence or saved conversations in V1

What it does not use:
- raw filing text
- embeddings
- vector search
- cross-company document retrieval

Grounding and cost rules:
- StockPulse structured data is the primary company-specific grounding source
- the model may use general financial knowledge to explain why metrics changed or what a ratio generally implies
- answers should distinguish StockPulse data from general context when both are used
- cost safety is operational, not database-enforced: load limited credits on the provider API key and rely on in-app quota plus burst limits

## Data Model

### Primary Tables

- `Company`
- `FinancialFact`
- `MetricSnapshot`
- `PriceCache`
- `IngestionRun`
- `RawSecPayload`
- `AIUsageCounter`

Retention rule:
- keep the latest successful payload per `company + source`
- keep the most recent failed payload for debugging

### Relationship Summary

```text
Company 1 ────────< FinancialFact
Company 1 ───────── 1 MetricSnapshot
Company 1 ────────< PriceCache
Company 1 ────────< IngestionRun (optional company FK)
Company 1 ────────< RawSecPayload

User 1 ───────────< AIUsageCounter (optional, anonymous rows have null user)
```

## Deployment Shape

V1 deployment target is a standard three-part shape:

```text
web app (Django API + frontend assets)
scheduled worker (management commands on a schedule)
PostgreSQL 16
```

No V1 components:
- Redis
- Celery workers
- Celery beat
- WebSockets for market data
- vector database

## Why No Celery/Redis in V1

Because the hardest problem is data correctness, not job fan-out.

Scheduled jobs in V1 are predictable:
- company ingestion
- financial ingestion
- metric snapshot recompute
- quote refresh

Celery/Redis becomes justified only if:
- one worker misses the V1 SLAs of quote refresh within 15 minutes or nightly jobs within 60 minutes twice in normal operation
- retries/orchestration become fragile enough to hurt reliability
- user-triggered durable async jobs become a real product need

## Failure Boundaries

### SEC ingestion fails
- `IngestionRun` records the failure
- previous normalized facts stay readable
- UI should continue serving the last good data

### Quote refresh fails
- `PriceCache.stale` becomes the visible signal
- stale data is shown instead of an empty price experience

### AI quota or provider failure
- quota exhaustion returns a clear upgrade-or-try-tomorrow response
- provider timeout or availability failures return a clear stream error instead of a hanging UI

### Auth refresh fails
- the user drops to logged-out state
- public browsing still works

## V2 Expansion Path

Not V1, but intentionally easy later:
- Celery/Redis for heavier async workloads
- watchlists and saved user data
- richer valuation scenarios
- RAG or vector search for cross-company analysis
