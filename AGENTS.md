# StockPulse

AI-powered stock analysis platform — React + Django + PostgreSQL.

## Read Order
Before planning or coding, read these in order:

1. [`docs/spec.md`](./docs/spec.md)
2. [`docs/plan.md`](./docs/plan.md)
3. [`docs/DESIGN.md`](./docs/DESIGN.md)
4. [`docs/architecture.md`](./docs/architecture.md)
5. [`docs/feature.md`](./docs/feature.md)
6. [`docs/techstack.md`](./docs/techstack.md)
7. [`docs/cicd.md`](./docs/cicd.md)

## Product Thesis
StockPulse V1 is a serious financial research tool for S&P 500 companies.

The target feeling is:
- understand the company fast
- trust the numbers
- move smoothly from Financials to Price to Valuation to AI

This is not a brokerage app, a social feed, or a trading terminal.

## Locked V1 Decisions
Do not reopen these unless the user explicitly changes product direction:

- public browsing stays open
- Google sign-in is the primary auth path
- email/password exists as fallback
- AI quotas are `10/day` anonymous and `50/day` authenticated
- AI also has a `3/minute` IP burst backstop and a hard daily budget cap
- Financials is the hero tab
- Price charts are line-only in V1 and use adjusted close by default
- Valuation is a Qualtrim-like DCF flow with `Earnings` and `Cash Flow` modes
- V1 uses scheduled Django management commands, not Celery/Redis, unless the documented SLAs fail twice in normal operation
- watchlists, saved chats, real-time quotes, news, vector search, and candlesticks are out of V1

## Engineering Priorities
- SEC normalization correctness is the core product risk.
- `FinancialFact` is canonical truth.
- `MetricSnapshot` powers fast overview and screener reads.
- `PriceCache` is supporting context, not real-time market truth.
- AI must only use structured StockPulse data already represented in the product.
- Prefer boring, deterministic paths over extra infrastructure.

## Design System
Always read [`docs/DESIGN.md`](./docs/DESIGN.md) before making any visual or UI decisions.

All font choices, colors, spacing, chart tokens, and aesthetic direction are defined there.

Do not deviate without explicit user approval.

In QA or review mode, flag any code that does not match [`docs/DESIGN.md`](./docs/DESIGN.md).

## Delivery Order
Build in milestone order from [`docs/plan.md`](./docs/plan.md):

1. Foundation
2. Ingestion and canonical data
3. Public read APIs and stock detail shell
4. Price, valuation, and screener
5. Authentication
6. AI copilot
7. Hardening and deploy

Do not jump ahead to AI polish or peripheral features before the Financials hero path is strong.

## M2 Execution Notes
While working on M2:

- start with a hard cut to the final canonical schema
- treat local/dev data as disposable and rebuild it after the schema cut
- do not add compatibility glue for unreleased local data
- build the metric registry before live SEC ingestion
- persist raw SEC payloads in `RawSecPayload`, not on `Company`
- replace `StockMetrics` with `MetricSnapshot`
- replace `compute_metrics` with `compute_snapshots`
- produce the S&P 500 coverage audit as a real M2 artifact

## Documentation Discipline
If you change product behavior or scope, update the matching docs in the same turn:

- update [`docs/spec.md`](./docs/spec.md) for top-level contract changes
- update [`docs/plan.md`](./docs/plan.md) for milestone, acceptance, or execution changes
- update [`docs/DESIGN.md`](./docs/DESIGN.md) for visual or interaction changes
- update [`docs/architecture.md`](./docs/architecture.md) for system shape, data flow, or job model changes
- update [`docs/feature.md`](./docs/feature.md) for route or feature-boundary changes
- update [`docs/techstack.md`](./docs/techstack.md) for dependency, auth, storage, or infrastructure changes
- update [`docs/cicd.md`](./docs/cicd.md) for CI, deploy, environment, release, or rollback changes

## Local Development
- Start the local stack with `make dev`.
- Frontend runs at `http://localhost:5173`; backend runs at `http://localhost:8000`.
- The frontend uses relative `/api` calls by default and Vite proxies them to Django on `localhost:8000`.
- Auth bootstraps from `GET /api/auth/session/`, which also seeds the CSRF cookie for state-changing auth requests.
- In local `DEBUG`, Google sign-in uses the real backend-managed redirect/callback flow when OAuth credentials are configured; otherwise `/api/auth/google/start/` falls back to the debug-only mock consent page.
- Gemini is the default local copilot provider when `GEMINI_API_KEY` is present; override with `AI_PROVIDER` or `ANTHROPIC_MODEL`/`GEMINI_MODEL` as needed.
- Set `VITE_API_BASE_URL` only when you need the frontend to target a non-default backend origin.

## Verification Expectations
Before considering major work done, aim to pass the repo gates defined in [`docs/plan.md`](./docs/plan.md):

- `make lint`
- `make test`
- `make build`
- Browser QA via gstack `/qa` for interactive flows; keep `make qa-smoke` as the repo gate

## Codex Agent Notes

**Do not use Playwright MCP for interactive browser work in this repo.** Browser QA from Codex should use gstack's `/qa` and `/browse` path with the browse binary. If your global config has Playwright MCP enabled, ignore it here.

For browser-based QA from Codex, use gstack skills in `.agents/skills/` (e.g., `gstack-qa`, `gstack-browse`). The browse binary is at `~/.codex/skills/gstack/browse/dist/browse`. Keep Playwright CLI and `make qa-smoke` for deterministic regression coverage and repo verification.

**Bug fix workflow:** Read `.gstack/qa-reports/` for the latest QA findings. Fix in severity order. One commit per fix: `fix(qa): ISSUE-NNN — short description`.
