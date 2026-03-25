# StockPulse

AI-powered stock analysis platform — React + Django + PostgreSQL.

## Read This First

This repo is the live StockPulse application.

Start here:

1. [`AGENTS.md`](./AGENTS.md)
2. [`spec.md`](./docs/spec.md)
3. [`plan.md`](./docs/plan.md)
4. [`DESIGN.md`](./docs/DESIGN.md)
5. [`architecture.md`](./docs/architecture.md)
6. [`feature.md`](./docs/feature.md)
7. [`techstack.md`](./docs/techstack.md)
8. [`cicd.md`](./docs/cicd.md)

## Important Context

- the current implementation under [`backend`](./backend) and [`frontend`](./frontend) is the source of truth
- the planning docs still matter, but they now describe shipped architecture plus remaining hardening work
- Financials is the hero tab
- Valuation is Qualtrim-like
- AI is supporting, not the main character

## Testing

Canonical verification commands:

- `make lint`
- `make test`
- `make build`
- `make qa-smoke`
- `make qa`

## Design System

Always read [`DESIGN.md`](./docs/DESIGN.md) before making visual or UI decisions.

All font choices, colors, spacing, chart tokens, and aesthetic direction are defined there.

Do not deviate without explicit user approval.
