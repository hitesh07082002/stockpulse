# StockPulse Tech Stack

**Status:** Target V1 stack  
**Date:** Mar 22, 2026  
**Source docs:** [`spec.md`](./spec.md), [`plan.md`](./plan.md), [`architecture.md`](./architecture.md), [`cicd.md`](./cicd.md)

## Stack Philosophy

The V1 stack is intentionally conservative:
- use proven frameworks
- keep state in PostgreSQL where practical
- avoid adding infrastructure before the product earns it
- spend complexity on SEC normalization, not orchestration theater

## Backend

| Layer | Choice | Why |
|---|---|---|
| Web framework | Django 6 | Boring, productive, mature auth/admin/model layer |
| API layer | Django REST Framework 3.17 | Standard, explicit request/serializer/view patterns |
| Database | PostgreSQL 16 | Strong relational fit for normalized facts, snapshots, and cache state |
| Auth | Django auth + `django-allauth` + `djangorestframework-simplejwt` | Google-first auth with backend redirect/callback flow, email/password fallback, and secure cookie transport |
| Rate limiting | `django-ratelimit` with a database-backed cache | Lightweight burst backstop without introducing Redis in V1 |
| AI client | `anthropic` | Streaming per-company copilot |
| Quote source | `yfinance` | Good enough for cached supporting price context in V1 |
| Parsing / data tools | `pandas`, `numpy`, `beautifulsoup4`, `requests` | SEC and data-shaping support where needed |

## Frontend

| Layer | Choice | Why |
|---|---|---|
| UI framework | React 19 | Current repo baseline |
| Router | React Router 7 | Matches current frontend baseline |
| Data fetching | TanStack Query 5 | Strong server-state and request lifecycle handling |
| Build tool | Vite 8 | Fast local dev and production build path |
| Styling | Tailwind 4 token layer | Fast UI iteration while still honoring `DESIGN.md` |
| Financial charts | Recharts 3 | Good fit for dashboard-style financial series and DCF visuals |
| Price chart | `lightweight-charts` 5 | Good fit for fast line-based price charts without overbuilding |
| Markdown rendering | `react-markdown` | Useful for AI response formatting and docs surfaces |

## Data Storage and Read Models

| Data type | Storage choice | Notes |
|---|---|---|
| Company metadata | PostgreSQL `Company` | Search and stock detail shell |
| Canonical financial facts | PostgreSQL `FinancialFact` | Core normalized truth |
| Overview / screener metrics | PostgreSQL `MetricSnapshot` | Fast read model |
| Price ranges | PostgreSQL `PriceCache` | Cache truth lives in DB |
| Ingestion runs | PostgreSQL `IngestionRun` | Operational visibility |
| Raw SEC payload retention | PostgreSQL `RawSecPayload` | Cold audit/debug store, off the hot company row, with bounded retention |
| AI quotas | PostgreSQL `AIUsageCounter` | Daily quota tracking |
| AI daily budget | PostgreSQL `AIBudgetDay` | Product-enforced spend cap |

## Auth and Session Model

- access and refresh tokens are stored in `httpOnly` cookies
- CSRF stays enabled for state-changing requests
- Google sign-in is part of V1
- refresh is cookie-based; the frontend does not post a refresh token body
- anonymous AI usage is tracked by a signed `anon_ai_id` cookie
- the hard daily AI budget is configured by environment variable and enforced before model invocation
- AI quota and budget resets use the `America/New_York` calendar day

## Job Execution Model

V1 background work uses Django management commands on a scheduled worker.

Scheduled jobs:
- `ingest_companies`
- `ingest_financials`
- `compute_snapshots`
- `update_prices`

### Why not Celery/Redis in V1

Because V1 jobs are predictable batch work, and the main risk is still data correctness.

Celery/Redis is deferred until one of these becomes true:
- one worker misses the V1 SLAs of quote refresh within 15 minutes or nightly jobs within 60 minutes twice in normal operation
- retry/orchestration needs become painful enough to justify queue infra
- user-triggered durable async work becomes a real feature

## Testing and Verification

| Layer | Planned tool | Purpose |
|---|---|---|
| Backend unit/integration | pytest | models, services, normalization, API behavior |
| Frontend unit/component | vitest | UI state, rendering, interaction logic |
| End-to-end smoke | Playwright | landing, search, stock detail, auth, AI flow |
| Linting | Ruff / ESLint | static quality gates |
| Build verification | `make build` | production build sanity |

## Deployment Shape

V1 deployment assumes:
- web process
- scheduled worker process
- PostgreSQL 16

Possible hosting options:
- app platform style deployment
- VM/container deployment with one scheduled worker

The plan does not require:
- Redis
- WebSocket infra
- vector database
- queue worker fleet

## Explicit Non-Choices

These are intentionally not part of V1:
- Celery
- Redis
- Kafka
- pgvector
- WebSockets for quotes
- brokerage APIs
- real-time market data vendors
- saved-user product features like watchlists

## Source of Truth

When these docs differ:
1. [`spec.md`](./spec.md) is the top-level product and launch contract
2. [`plan.md`](./plan.md) is the implementation and milestone source of truth
3. [`DESIGN.md`](./DESIGN.md) is the visual and interaction source of truth
4. [`architecture.md`](./architecture.md) explains system shape
5. [`feature.md`](./feature.md) explains product boundaries
6. [`techstack.md`](./techstack.md) explains technology choices
7. [`cicd.md`](./cicd.md) explains CI/CD and release strategy
