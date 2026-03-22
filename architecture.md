# StockPulse Architecture

**Status:** Drafted from the final V1 plan  
**Date:** Mar 22, 2026  
**Source docs:** [`spec.md`](./spec.md), [`plan.md`](./plan.md), [`DESIGN.md`](./DESIGN.md), [`cicd.md`](./cicd.md)

## Goal

StockPulse V1 is a public-first stock research application. The system is optimized for a clear read path:

1. ingest and normalize SEC financial data
2. cache price context and derived metrics
3. serve a fast stock detail experience
4. layer grounded AI explanation on top of the same structured data

The architecture is intentionally boring in V1: PostgreSQL-backed truth, Django APIs, React frontend, scheduled jobs, no Celery/Redis, no vector search, no real-time streaming quotes.

## Architecture Principles

- PostgreSQL is the source of truth for application data and cache state.
- SEC normalization correctness matters more than job orchestration sophistication.
- Public browsing stays open; auth only adds quota and future user-owned features.
- AI is a product layer over existing data, not a separate knowledge system.
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
         │ compute_snapshots / refresh_prices                │
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
yfinance ──► refresh_prices ──► PriceCache + Company quote fields
                                   │
                                   └─ stale metadata exposed to UI
```

Responsibilities:
- serve range-based price charts quickly
- serve adjusted-close trend lines by default for research-oriented price context
- surface freshness clearly
- bound long-range payload size with deterministic downsampling by range
- fall back to stale data instead of failing silently

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

### 5. AI Copilot

The AI layer interprets structured StockPulse data only.

```text
user prompt
   │
   ├─ check signed anon cookie or authenticated user
   ├─ enforce daily quota
   ├─ enforce burst limit
   ├─ reserve daily AI budget
   ├─ assemble company context
   ▼
Anthropic model call (streaming)
   │
   ├─ reconcile actual spend
   └─ stream answer to UI
```

Context inputs:
- company metadata
- cached quote
- latest `MetricSnapshot`
- 10 annual periods
- 8 recent quarters

What it does not use:
- raw filing text
- embeddings
- vector search
- cross-company document retrieval

Budget rule:
- a hard daily AI budget is configured by env var
- daily usage and budget windows reset on the `America/New_York` calendar day
- each request reserves budget before the model call
- actual cost is reconciled after completion
- once the daily cap is exhausted, new requests are rejected until the next day

## Data Model

### Primary Tables

- `Company`
- `FinancialFact`
- `MetricSnapshot`
- `PriceCache`
- `IngestionRun`
- `RawSecPayload`
- `AIUsageCounter`
- `AIBudgetDay`

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
AIBudgetDay is daily global spend state
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

### AI budget exhausted
- model invocation is blocked before spend increases
- UI gets a clear budget/error state instead of a hanging stream

### Auth refresh fails
- the user drops to logged-out state
- public browsing still works

## V2 Expansion Path

Not V1, but intentionally easy later:
- Celery/Redis for heavier async workloads
- watchlists and saved user data
- richer valuation scenarios
- RAG or vector search for cross-company analysis
