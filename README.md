# StockPulse

Stock research app for the S&P 500: canonical SEC financials, cached price context, guarded DCF workflows, and a per-company AI copilot.

**Live:** [stockpulse.hiteshsadhwani.xyz](https://stockpulse.hiteshsadhwani.xyz)

## Features

- **Search** — Instantly find any S&P 500 company by ticker or name
- **Financials** — 30 years of annual and quarterly SEC data with derived margins, free cash flow, and ROE
- **Price Charts** — Adjusted close with 1M to MAX range selection
- **DCF Calculator** — Earnings and cash flow valuations with editable assumptions
- **AI Copilot** — Ask questions about any company with structured StockPulse data as the primary grounding source
- **Screener** — Filter and sort 500 companies by PE, margins, growth, debt, and free cash flow
- **Auth** — Google sign-in, verified email/password auth, secure password reset, and backend-managed cookie sessions
- **Responsive UI** — Mobile screener cards + filter sheet, responsive stock-detail tabs, and smoke coverage for critical phone-sized flows

## Tech Stack

React 19 · Django 6 · PostgreSQL 16 · Anthropic/Gemini provider seam · Tailwind CSS · Recharts · lightweight-charts

## Local Development

```bash
make dev
# Frontend: http://localhost:5173
# Backend: http://localhost:8000
```

Local auth notes:
- New email/password signups require email verification before the first sign-in.
- Dev password-reset emails use the console backend by default, so reset links are printed in the backend terminal.
- Dev verification emails use the same backend, so verification links are also printed in the backend terminal.
- Production requires a real SMTP-backed `EMAIL_BACKEND`, a valid `FRONTEND_APP_ORIGIN`, and `ENABLE_GOOGLE_OAUTH_MOCK=False`.

## Django Admin

```bash
venv/bin/python backend/manage.py createsuperuser
make dev
```

Then open [http://localhost:8000/admin/](http://localhost:8000/admin/) and sign in with the superuser you created. The admin is an operator surface for browsing companies, financial facts, snapshots, ingestion runs, price cache rows, raw SEC payloads, and AI usage counters.

Optional local container flow:

```bash
make docker-up
make docker-down
```

## Verification

Canonical local gates:

```bash
make lint
make test
make build
make qa-smoke
```

## Deployment

- GitHub Actions CI runs backend checks, frontend checks, and Playwright smoke
- pushes to `main` trigger the production deploy workflow
- production deploys use immutable GHCR images tagged by commit SHA
- the server runs Docker Compose + host `nginx` + PostgreSQL + host cron jobs
- price cache refresh and snapshot recompute run every 15 minutes in production

See [AGENTS.md](./AGENTS.md) for detailed setup and contributing guidelines.

## Documentation

Detailed docs live in [`docs/`](./docs/):

- [Product Spec](./docs/spec.md)
- [Architecture](./docs/architecture.md)
- [Feature Contract](./docs/feature.md)
- [Design System](./docs/DESIGN.md)
- [CI/CD](./docs/cicd.md)
- [Delivery Plan / Record](./docs/plan.md)
- [Open TODOs](./docs/TODOS.md)

## License

MIT
