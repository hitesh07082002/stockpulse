# StockPulse

S&P 500 financial research — 30 years of SEC data, AI analysis, and DCF valuations.

**Live:** [stockpulse.hiteshsadhwani.xyz](https://stockpulse.hiteshsadhwani.xyz)

<!-- TODO: Add screenshot of Financials tab here -->

## Features

- **Search** — Instantly find any S&P 500 company by ticker or name
- **Financials** — 30 years of annual and quarterly data from SEC 10-K/10-Q filings
- **Price Charts** — Adjusted close with 1M to MAX range selection
- **DCF Calculator** — Earnings and cash flow valuations with editable assumptions
- **AI Copilot** — Ask questions about any company, grounded in real financial data
- **Screener** — Filter and sort 500 companies by PE, margins, growth, and more

## Tech Stack

React 19 · Django 6 · PostgreSQL 16 · Claude API · Tailwind CSS · Recharts

## Local Development

```bash
make dev
# Frontend: http://localhost:5173
# Backend: http://localhost:8000
```

See [AGENTS.md](./AGENTS.md) for detailed setup and contributing guidelines.

## Documentation

Detailed docs live in [`docs/`](./docs/):

- [Product Spec](./docs/spec.md)
- [Architecture](./docs/architecture.md)
- [Design System](./docs/DESIGN.md)
- [CI/CD](./docs/cicd.md)
- [Implementation Plan](./docs/plan.md)

## License

MIT
