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
- Valuation is a Qualtrim-like DCF flow
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

## M1 Progress

M1 foundation work is complete and verified.

Already in place:
- root entry points: `make dev`, `make lint`, `make test`, `make build`
- backend pytest scaffold
- frontend Vitest scaffold
- Playwright smoke scaffold
- 25-company representative seed fixture
- initial GitHub Actions CI workflow

Latest verification pass:
- `make lint`
- `make test`
- `make build`
- `make qa-smoke`
- `PLAYWRIGHT_BASE_URL=http://localhost:5173 npm --prefix frontend run test:e2e -- tests/e2e/stock-detail.spec.js`

Next up:
- M2 ingestion and canonical data is now in progress
- the schema cut, metric registry, canonical `ingest_financials`, and `compute_snapshots` are now in place
- local SQLite dev data was reset and rebuilt from the real pipeline for the 25-company development set
- the local dev dataset now includes live SEC facts, bounded raw payload retention, current quotes, and `MetricSnapshot` rows for every seeded company
- next M2 work is expanding beyond the 25-company dev set to the full S&P 500 and recording the launch coverage audit

## Local Development

Canonical local entrypoint:
- run `make dev`
- open [http://localhost:5173](http://localhost:5173)

Local development now assumes:
- the browser entrypoint is `localhost:5173`
- the frontend calls relative `/api` by default
- Vite proxies `/api` to Django on `localhost:8000`

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
