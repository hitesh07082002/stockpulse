# StockPulse

AI-powered stock research platform built with React, Django, and PostgreSQL.

## Current Status

StockPulse is in a **scratch-build rewrite** phase.

The planning docs are now the source of truth. The existing implementation in [`backend`](./backend) and [`frontend`](./frontend) is legacy reference material, not the architectural foundation of the rebuild.

## Start Here

If you are a new engineer or a fresh agent session, read these in order:

1. [`AGENTS.md`](./AGENTS.md)
2. [`spec.md`](./spec.md)
3. [`plan.md`](./plan.md)
4. [`DESIGN.md`](./DESIGN.md)
5. [`architecture.md`](./architecture.md)
6. [`feature.md`](./feature.md)
7. [`techstack.md`](./techstack.md)
8. [`cicd.md`](./cicd.md)

## What StockPulse V1 Is

StockPulse V1 is a serious financial research tool for S&P 500 companies.

Core product promise:
- search a company fast
- understand the business quickly
- inspect trustworthy financial and valuation context
- ask grounded AI questions from the same structured data

V1 is **not**:
- a brokerage app
- a trading terminal
- a portfolio tracker
- a news or social product

## Locked V1 Decisions

- browsing stays public
- Google sign-in is the primary auth path
- email/password exists as fallback
- AI limits are `10/day` anonymous and `50/day` authenticated
- Price charts are line-only in V1
- DCF Calculator is a Qualtrim-like DCF flow
- Financials is the hero tab
- scheduled Django management commands are used instead of Celery/Redis in V1 unless the documented SLAs fail

## Canonical Docs

- [`spec.md`](./spec.md): top-level product and launch contract
- [`plan.md`](./plan.md): milestones, build order, verification gates, acceptance criteria
- [`DESIGN.md`](./DESIGN.md): visual and interaction source of truth
- [`architecture.md`](./architecture.md): system shape and data flow
- [`feature.md`](./feature.md): routes and feature boundaries
- [`techstack.md`](./techstack.md): technology choices
- [`cicd.md`](./cicd.md): CI/CD, release, and deployment strategy

## Implementation Order

Implementation should follow the milestone sequence in [`plan.md`](./plan.md):

1. M1 Foundation
2. M2 Ingestion and Canonical Data
3. M3 Public Read APIs and Stock Detail Shell
4. M4 Price, Valuation, and Screener
5. M5 Authentication
6. M6 AI Copilot
7. M7 Hardening and Deploy

Do not jump ahead to AI polish or peripheral product features before the Financials hero path is strong.

## Current Codebase Policy

- the current app in [`backend`](./backend) and [`frontend`](./frontend) may be used as reference
- old component boundaries, endpoints, and abstractions are not binding
- replace slices milestone by milestone
- do not maintain a long-lived parallel legacy app inside `main`

## Milestone Progress

M1, M2, M3, M4, M5, and M6 are complete and verified.

Already in place:
- root entry points: `make dev`, `make lint`, `make test`, `make build`
- coverage entry point: `make coverage`
- backend pytest scaffold
- frontend Vitest scaffold
- Playwright smoke scaffold
- 25-company representative seed fixture
- initial GitHub Actions CI workflow
- search-first landing page with live company search
- stock detail shell with quote freshness and mobile-safe tab bar
- overview and financials tabs wired to canonical company detail, snapshot, and SEC facts endpoints
- company list/detail/financials API coverage, frontend state coverage, and landing -> detail -> Financials smoke coverage
- cache-backed price ranges with stale fallback and adjusted-close line charts
- valuation guardrails for financial-sector disable, negative earnings / FCF warnings, missing shares-outstanding handling, and annualized CAGR comparison against the desired return input
- focused screener filters with exact GICS sector names and API-driven sorting on top of `MetricSnapshot`
- M4 API coverage, frontend unit coverage for price/valuation/screener states, and smoke coverage for price range selection and screener -> company navigation
- secure cookie auth with `/api/auth/session/`, register/login/refresh/logout, and backend-managed Google redirect/callback
- Google-first auth modal in the shell, with email/password fallback and visible logged-in state in the header + AI tab
- M5 API coverage for register/login/refresh/logout and Google auto-linking, plus smoke coverage for register/login/logout and Google sign-in
- structured AI context built from company metadata, freshness, snapshot, 10 annual periods, 8 recent quarters, and explicit coverage signals
- canonical SSE copilot stream events: `meta`, `text`, `error`, and `done`
- signed anonymous AI identity with 10/day anonymous quota, 50/day authenticated quota, and a 3/minute IP burst limit
- bounded follow-up memory from the active client session without saved chats
- provider seam with Anthropic as the production default and Gemini available for local/dev/staging
- M6 API coverage for copilot quota/failure semantics, provider normalization, frontend AI tab state coverage, and smoke coverage for prompt submit plus anonymous -> sign-in upgrade flow

Latest verification pass:
- `make lint`
- `make test`
- `make build`
- `make qa-smoke`

Next up:
- M7 hardening and deploy

Current data layer status:
- M2 ingestion and canonical data is complete
- the schema cut, metric registry, canonical `ingest_financials`, `update_prices`, and `compute_snapshots` are now in place
- local SQLite dev data was reset and rebuilt from the real pipeline with the full 500-company universe
- the current company universe is loaded at the company level by unique CIK, so the 503-row constituent snapshot normalizes to 500 companies after share-class dedupe
- company metadata is still intentionally thin: the current universe loader populates `ticker`, `name`, `sector`, `industry`, and `cik`, so many `description`, `website`, and `exchange` fields remain blank until a dedicated metadata-enrichment step is added
- the current local dataset includes live SEC facts, bounded raw payload retention, current quotes, and `MetricSnapshot` rows for all 500 companies
- canonical facts can be rebuilt from retained raw SEC payloads with `ingest_financials --from-cache --force`, so full-universe replays do not depend on live SEC availability
- the launch coverage audit artifact at [`docs/audits/sp500-launch-coverage-2026-03-22.md`](./docs/audits/sp500-launch-coverage-2026-03-22.md) now passes the `95%+` gate
- `gross_profit` and `gross_margin` are audited conditionally, only where retained SEC payloads expose a comparable gross-profit or cost-of-revenue concept

## Local Development

Canonical local entrypoint:
- run `make dev`
- open [http://localhost:5173](http://localhost:5173)

Local development now assumes:
- the browser entrypoint is `localhost:5173`
- the frontend calls relative `/api` by default
- Vite proxies `/api` to Django on `localhost:8000`
- local auth bootstraps from `GET /api/auth/session/`, which also seeds the CSRF cookie for state-changing auth requests and tells the frontend whether a refresh cookie is actually present before attempting silent refresh

Google sign-in in local dev:
- with real Google OAuth credentials configured, the backend-managed redirect/callback flow is used
- without Google credentials in `DEBUG`, `/api/auth/google/start/` falls back to a debug-only mock consent page so local smoke and manual auth testing stay deterministic

AI provider config in local dev:
- set `GEMINI_API_KEY` to use Gemini in local `DEBUG`
- optional: set `AI_PROVIDER=gemini` explicitly; otherwise `DEBUG` auto-selects Gemini when `GEMINI_API_KEY` is present
- default local Gemini model is `GEMINI_MODEL=gemini-2.5-flash`
- grounded Gemini copilot requests default to `GEMINI_THINKING_BUDGET=0` so hidden reasoning does not burn the response budget on this structured Q&A path
- Anthropic remains the production-default provider and defaults to Haiku 4.5; override with `AI_PROVIDER=anthropic` plus `ANTHROPIC_MODEL` if needed
- model pricing env vars remain configurable: `GEMINI_INPUT_COST_PER_MTOK_USD`, `GEMINI_OUTPUT_COST_PER_MTOK_USD`, `ANTHROPIC_INPUT_COST_PER_MTOK_USD`, `ANTHROPIC_OUTPUT_COST_PER_MTOK_USD`

If you need a different backend origin for local work, set `VITE_API_BASE_URL`.

## CI/CD Direction

The intended delivery model is:
- required PR checks on GitHub Actions
- protected `main`
- staging auto-deploy
- production manual promotion
- automated migrations
- post-deploy smoke and rollback path

Details live in [`cicd.md`](./cicd.md).

## Notes for New Agent Sessions

Before changing behavior:
- update the matching docs in the same turn
- preserve the rewrite strategy in [`plan.md`](./plan.md)
- treat SEC normalization correctness as the top engineering priority
- keep AI grounded only in structured StockPulse data
