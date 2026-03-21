# StockPulse V1 — Product & Project Plan

> An AI-powered US stock analysis platform. Search any S&P 500 stock, explore 30 years of financial data across 10+ interactive charts, calculate fair value with a DCF model, discover stocks with a powerful screener, and ask an AI copilot anything about a company's financials.
>
> **Pitch**: *"I built an AI-powered stock analysis platform that serves 30 years of SEC financial data with natural language insights — what Qualtrim charges $30/month for, using only free government data and Claude API."*

---

## Project Setup

- **Repo:** https://github.com/hitesh07082002/stockpulse (public)
- **Design system:** [DESIGN.md](DESIGN.md) — typography, colors, spacing, layout, motion all locked in
- **Hosting:** DigitalOcean ($200 credits) — App Platform + Managed PostgreSQL
- **Domain:** TBD — will purchase (stockpulse.dev / stockpulse.app / getstockpulse.com)
- **Status:** Architecture review complete — ready to implement

---

## What Sets This Apart

1. **AI Financial Copilot** — per-stock natural language Q&A grounded in real SEC filing data. Structured financial data + smart pruning + honest framing via Claude Sonnet. The AI interprets numerical trends and cites specific data points — not a generic chatbot wrapper.
2. **30 Years of Real Data** — SEC EDGAR XBRL pipeline ingests, normalizes, and serves actual financial data for S&P 500 companies. Idempotent, resumable ingestion with progress tracking. Messy real-world data engineering, not mock data.
3. **Production Polish** — Dark mode default, loading skeletons, responsive design, custom domain, SSL, error handling, rate limiting, graceful degradation when upstream data sources are unavailable.

---

## V1 Features (6 Core)

### 1. Stock Search & Company Profile
- Typeahead search across ~500 S&P 500 companies
- Company overview: name, sector, market cap, price, 52-week range, description
- **Data**: SEC EDGAR (company info) + yfinance (price/market cap, cached)

### 2. Financial Analysis Dashboard (Hero Feature)
- 10+ interactive charts: Revenue, Net Income, EPS, FCF, EBITDA, Gross/Operating/Net Margins, Total Debt, Debt-to-Equity, ROE, Cash & Equivalents
- Toggle quarterly / annual view
- 30+ years of historical data from SEC EDGAR XBRL
- **Data**: SEC EDGAR (`data.sec.gov/api/xbrl/companyfacts/`)

### 3. Interactive Price Chart
- Candlestick/line chart with volume bars
- Timeframe selector (1M/3M/6M/1Y/5Y/MAX)
- 50 & 200 day SMA overlays
- Staleness badge when data is older than 15 minutes
- **Data**: yfinance (proxied through backend, cached)

### 4. DCF Calculator
- Auto-populated with computed FCF (Operating Cash Flow − CapEx) from SEC filings
- User adjusts: growth rate, WACC (6-15%), terminal growth rate (1-4%), projection years (3-10)
- Output: fair value per share, upside/downside %, sensitivity heatmap
- Sector warnings for Financials/REITs where DCF is less applicable
- Handles negative FCF gracefully with warning banner
- **Data**: SEC EDGAR (computed FCF) + user inputs

### 5. Stock Screener
- Filter by: market cap, P/E, dividend yield, revenue growth %, profit margin, sector, ROE, debt-to-equity
- Sortable results table with click-through to stock detail
- Pre-computed `StockMetrics` table updated daily
- **Data**: SEC EDGAR + yfinance

### 6. AI Financial Copilot (The Differentiator)
- Per-stock chat interface: "Ask about this company's financials"
- Context strategy: last 10 years annual + last 8 quarters of normalized metrics (~2,000-3,000 tokens)
- System prompt frames AI as interpreting numerical trends, not citing filing text
- Example queries:
  - "Why did revenue drop in 2020?"
  - "Is this stock overvalued based on its historical P/E?"
  - "Compare this company's margins to the sector average"
  - "Summarize the key financial trends over the last 5 years"
- Rate limiting: 50 queries/day per session token, 3 req/min per IP, $5/day hard cap on Anthropic dashboard
- Model: Claude Sonnet for quality financial analysis
- Streaming responses (SSE) for snappy UX
- **Data**: Normalized financial data (10yr window) + current price + pre-computed metrics

---

## Authentication

### Core: Email/Password + Google Sign-In

```
Registration: POST /api/auth/register/   { email, password, name }
Login:        POST /api/auth/login/      { email, password } → { access, refresh }
Google:       POST /api/auth/google/     { google_token } → { access, refresh }
Refresh:      POST /api/auth/refresh/    { refresh } → { access }
```

- Django built-in User model + djangorestframework-simplejwt for JWT
- Google OAuth via django-allauth (social login)
- **JWT stored in httpOnly cookies** (not localStorage) — CSRF protection via Django middleware
- Frontend: login/register modal (not a separate page), auth context provider
- AI copilot: 5 free queries/day unauthenticated (IP-based), 50/day authenticated (per-user)
- After free limit: "Sign in for 45 more free queries today"
- All other endpoints (financials, prices, screener) remain public — no login required to browse data

---

## NOT in V1 (Planned V2)
- Portfolio tracker & watchlists
- Real-time WebSocket prices (Django Channels)
- News feed & earnings calendar (Finnhub)
- Macro dashboard (FRED API)
- RAG pipeline with pgvector for cross-company AI analysis
- Dynamic context pruning (parse user question to select relevant metrics/timeframe)

---

## Architecture

### Database Schema (4 models)

```
Company
├── cik (CharField, unique)           # SEC identifier
├── ticker (CharField, unique, indexed)
├── name, sector, industry, description
├── current_price (Decimal, cached)   # from yfinance
├── market_cap (BigInt, cached)
├── week_52_high/low, shares_outstanding
├── price_updated_at
├── raw_facts_json (JSONField)        # full SEC response for AI context
└── facts_updated_at

FinancialFact
├── company (FK → Company)
├── metric (CharField, indexed)       # 'revenue', 'net_income', etc.
├── period_type ('annual'/'quarterly')
├── fiscal_year, fiscal_quarter
├── period_end_date
├── value (Decimal 20,2)
├── unit, form_type, filed_date
└── unique_together: [company, metric, period_type, fiscal_year, fiscal_quarter]

StockMetrics
├── company (OneToOne → Company)
├── pe_ratio, dividend_yield
├── revenue_growth_yoy, profit_margin
├── gross_margin, operating_margin
├── roe, debt_to_equity, free_cash_flow
└── computed_at

IngestionLog
├── company (FK → Company)
├── source ('sec_edgar' / 'yfinance')
├── status ('success' / 'failed' / 'in_progress')
├── error_message (nullable)
├── records_created (int)
├── started_at, completed_at
└── Viewable in Django Admin
```

### XBRL Normalization

Priority-ordered Python dict mapping our metric names to SEC XBRL tags:

```
XBRL_METRIC_MAP = {
    'revenue': ['Revenues', 'RevenueFromContractWithCustomer...', 'SalesRevenueNet', ...],
    'net_income': ['NetIncomeLoss', 'NetIncomeLossAvailableToCommon...', ...],
    'eps_diluted': ['EarningsPerShareDiluted', 'EarningsPerShareBasic'],
    'free_cash_flow': COMPUTED (operating_cash_flow - capex),
    ... (~15 metrics total)
}
```

Graceful gaps: if no XBRL tag matches for a company, store NULL, show "Data not available" in UI.

### API Endpoints

```
GET  /api/companies/                         → List (search, sector filter, pagination)
GET  /api/companies/{ticker}/                → Detail (includes cached price data)
GET  /api/companies/{ticker}/financials/     → Financial data
     ?metric=revenue,net_income              → Filter by metric(s)
     ?period_type=annual                     → annual or quarterly
     ?start_year=2000                        → Filter by year range
GET  /api/companies/{ticker}/prices/         → Price history (proxied yfinance, cached)
     ?range=1M|3M|6M|1Y|5Y|MAX              → Timeframe
GET  /api/companies/{ticker}/dcf-inputs/     → FCF, growth rate, shares outstanding, sector warning
GET  /api/screener/                          → Filterable stock list
     ?sector=Technology                      → Filter by sector
     ?pe_min=5&pe_max=25                     → Range filters
     ?sort=market_cap&order=desc             → Sorting
     ?page=1&page_size=25                    → Pagination
POST /api/companies/{ticker}/chat/           → AI chat (streaming SSE)
     { "message": "Why did revenue drop?" }
```

### Data Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    Management Commands                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ingest_companies                                             │
│     ├── Fetch S&P 500 list (hardcoded CSV)                       │
│     └── Create/update Company records                            │
│                                                                  │
│  2. ingest_financials                                            │
│     ├── For each Company (skip if recent IngestionLog success):  │
│     │   ├── Create IngestionLog (status=in_progress)             │
│     │   ├── GET data.sec.gov/api/xbrl/companyfacts/{CIK}        │
│     │   ├── Rate limit: 10 req/sec (SEC policy)                  │
│     │   ├── Store raw JSON in Company.raw_facts_json             │
│     │   ├── Parse XBRL → map to our metrics via XBRL_METRIC_MAP │
│     │   ├── Upsert FinancialFact records                         │
│     │   └── Update IngestionLog (status=success/failed)          │
│     ├── --force: re-ingest even if recent success                │
│     ├── --ticker AAPL: ingest single company                     │
│     └── Retry: SEC 429 → exponential backoff (1s, 2s, 4s)       │
│                                                                  │
│  3. update_prices                                                │
│     ├── For each Company:                                        │
│     │   ├── Fetch current price via yfinance                     │
│     │   └── Update cached fields + price_updated_at              │
│     └── On failure: keep stale data, log error                   │
│                                                                  │
│  4. compute_metrics                                              │
│     ├── For each Company:                                        │
│     │   ├── Query latest FinancialFacts + cached price           │
│     │   ├── Compute P/E, margins, growth, ROE, etc.              │
│     │   └── Upsert StockMetrics record                           │
│     └── Handles division by zero, missing data → NULL            │
│                                                                  │
│  Cron schedule:                                                  │
│  ├── ingest_financials: weekly (SEC data updates quarterly)      │
│  ├── update_prices: daily (during market hours)                  │
│  └── compute_metrics: daily (after update_prices)                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### AI Copilot Architecture

```
POST /api/companies/{ticker}/chat/
│
├── Rate limit check (IP: 3/min + Session: 50/day)
│   └── If exceeded → 429 with friendly message
│
├── Load company context (fixed 10-year window):
│   ├── Company basic info (name, sector, description)
│   ├── Current price + market cap
│   ├── Last 10 years annual data (~150 data points)
│   ├── Last 8 quarters (~120 data points)
│   └── Pre-computed metrics (P/E, margins, etc.)
│
├── Build system prompt:
│   ├── "You are a financial analyst. Analyze the data provided."
│   ├── "Cite specific numbers from the data."
│   ├── "You are interpreting numerical trends, not quoting filings."
│   └── Inject ~2,000-3,000 tokens of structured financial data
│
├── Send to Claude Sonnet (streaming):
│   ├── anthropic.messages.create(stream=True)
│   └── max_tokens: 1024
│
└── StreamingHttpResponse (SSE format)
    └── yield each chunk as SSE data event
```

### yfinance Fallback Strategy

```
Frontend requests price data
         │
         ▼
Is cached data fresh? (price_updated_at < 15 min)
    │ YES           │ NO
    ▼               ▼
Serve cache    Try yfinance
                    │
             ┌──────┴──────┐
             │ Success?    │
             │ YES    NO   │
             ▼        ▼
        Update    Serve STALE
        cache     cache + badge
        + serve   "Updated Xh ago"

Cache TTLs:
  Current price/quote:    15 min
  Price chart (daily):    4 hours
  Price chart (weekly+):  24 hours
```

---

## Tech Stack

### Backend
| Component | Choice |
|---|---|
| Framework | Django 5 + Django REST Framework |
| Database | PostgreSQL 16 (DigitalOcean Managed) |
| AI | Claude Sonnet (Anthropic SDK) via Django StreamingHttpResponse |
| Background jobs | Django management commands + cron (no Celery in V1) |
| Auth | Django auth + simplejwt + django-allauth (Google OAuth) |
| Rate limiting | django-ratelimit (IP) + per-user counter (DB) |
| Admin | Django Admin — ingestion monitoring, data management |

### Frontend
| Component | Choice |
|---|---|
| Framework | React 18 + Vite |
| Price charts | Lightweight Charts (TradingView open-source) |
| Financial charts | Recharts |
| AI chat UI | Custom component with streaming markdown |
| Server state | TanStack Query (React Query) |
| Routing | React Router v6 |
| Styling | Vanilla CSS with design system variables |
| Theme | Dark mode default with light mode toggle |

### Infrastructure
| Service | Cost/mo |
|---|---|
| DO App Platform (backend + frontend) | ~$12 |
| DO Managed PostgreSQL | ~$15 |
| Custom domain + SSL | ~$12/year |
| Claude API (Sonnet, rate-limited) | ~$5-10 |
| **Total** | **~$32-37/mo** (~5-6 months with $200 credits) |

---

## Data Sources

| Source | What | License | Cost |
|---|---|---|---|
| **SEC EDGAR** | Financials (30+ yrs), company info | US Public domain | Free |
| **yfinance** | Price data (OHLCV), current quotes | Public Yahoo data | Free |
| **Claude API** | AI-powered financial analysis | Anthropic | ~$5-10/mo |

---

## Data Scope

**V1: S&P 500 (~500 companies)**

All 6 features at 500 companies beats 2 features at 7,000. A complete, polished product with fewer companies is a stronger portfolio piece than a half-built one with full coverage.

---

## Pages & UI Design

### Page Map
```
/                    → Landing — tool-first, search-dominant
/stock/:ticker       → Stock Detail — tabbed, persistent company header
/screener            → Stock Screener — filter sidebar + results table
/about               → About + data sources + architecture diagram
```

### Landing Page (/)
**Approach: Tool-first. No hero. No marketing copy.**

```
┌──────────────────────────────────────────────────┐
│ StockPulse                            [Sign In]  │
├──────────────────────────────────────────────────┤
│                                                  │
│        Search any S&P 500 company                │
│   [__________________________________ 🔍]        │
│   Try: AAPL · MSFT · TSLA · GOOGL · JPM         │
│                                                  │
├──────────────────────────────────────────────────┤
│ S&P 500   │ AAPL     │ MSFT     │ NVDA          │
│ 5,831     │ $198.42  │ $421.30  │ $875.50       │
│ -1.13%    │ +0.82%   │ -0.45%   │ +2.31%        │
├──────────────────────────────────────────────────┤
│                                                  │
│ Top Gainers      Top Losers       Most Active    │
│ ──────────       ──────────       ───────────    │
│ NVDA +4.2%       INTC -3.1%      AAPL  52M vol  │
│ META +2.8%       BA   -2.7%      TSLA  48M vol  │
│ AMD  +2.1%       PFE  -2.3%      NVDA  41M vol  │
│                                                  │
├──────────────────────────────────────────────────┤
│ [Screener]      Powered by SEC EDGAR + AI        │
└──────────────────────────────────────────────────┘
```

### Stock Detail Page (/stock/:ticker)
**Persistent header + 5 tabs**

```
┌──────────────────────────────────────────────────┐
│ [← Back] StockPulse  [Search 🔍]     [Sign In]  │
├──────────────────────────────────────────────────┤
│ AAPL                                  $198.42    │
│ Apple Inc.                        +$1.62 (+0.82%)│
│ Technology · Consumer Electronics  MCap: $3.02T  │
├──────────────────────────────────────────────────┤
│ [Overview] [Financials] [Price] [Valuation] [AI] │
├──────────────────────────────────────────────────┤
│                                                  │
│              [Tab content below]                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Financials Tab (Hero Feature):**
- Top: 4 key metric mini-cards (Revenue, Net Income, EPS, FCF) with sparklines + YoY change
- Click any card to expand as the main chart
- Main chart: full-width, annual/quarterly toggle
- Bottom: "More Metrics" pill buttons (EBITDA, Margins, Debt, ROE, Cash, Shares)

**Overview Tab:** Key stats grid (Market Cap, P/E, 52-wk, Dividend) + company description
**Price Tab:** Full-width TradingView chart + timeframe pills + SMA toggles
**Valuation Tab:** DCF result at top (fair value + upside/downside badge) + input sliders + sensitivity heatmap
**AI Tab:** Chat interface with 3-4 suggested prompt pills + message input at bottom

### AI Tab (Unauthenticated)
Blurred chat interface behind a centered sign-in card: "Sign in to ask about [Company]'s financials" + email/password + Google button. Creates desire without blocking exploration.

### Screener (/screener)
- Desktop: collapsible filter sidebar + sortable results table + pagination
- Mobile: filters as a bottom sheet, results as cards (not table)

---

## Interaction States

| Feature | Loading | Empty | Error |
|---------|---------|-------|-------|
| Search | Debounced, results appear as typed | "Search any S&P 500 company" | "Search unavailable" |
| Market Movers | Skeleton cards (pulsing) | "Market data loading..." | "Market data temporarily unavailable" |
| Financial Charts | Skeleton chart shape | "No financial data for [Company]" | "Failed to load. Try again." |
| Price Chart | Skeleton chart | "Price data unavailable" | "Unable to load price data" + stale badge |
| DCF Calculator | Skeleton sliders | "Insufficient data for DCF" | "Unable to compute fair value" |
| AI Chat | Typing indicator (pulsing dots) | 3 suggested prompt pills | "AI temporarily unavailable" |
| AI Rate Limit | — | — | "You've used 50/50 queries today" |
| Screener | Skeleton table rows | "No companies match filters. Try adjusting." | "Failed to load screener" |

**Loading approach:** Skeleton screens everywhere (pulsing gray placeholders matching content layout). Content fades in when ready. No spinners.

---

## Responsive Design

**Mobile (< 640px):**
- Landing: search full-width sticky top, market movers vertical stack
- Stock detail header: compact (ticker + price), tabs horizontal scroll
- Financials: mini-cards 2x2 grid, chart full-width (60vh), metric pills horizontal scroll
- Price: chart full-width, timeframe pills horizontal scroll
- AI: full-screen chat (like iMessage), input sticky bottom
- Screener: filters as bottom sheet, results as cards not table

**Tablet (640-1024px):**
- Landing: 2-column market movers
- Financials: 4 mini-cards in a row, chart full-width
- Screener: collapsible sidebar filters

**Accessibility:**
- Touch targets: 44px minimum
- Color contrast: WCAG AA (4.5:1 body, 3:1 large text)
- Keyboard: Tab through all interactive elements, Enter to submit
- ARIA: landmarks for main/nav/search, role="tablist" for tabs
- Focus ring: 2px teal outline on all focusable elements
- Charts: accessible data table alternative (aria-described)

---

## Anti-Slop Rules

- NO hero sections, gradient backgrounds, or marketing copy on landing
- NO 3-column feature grids
- NO gradient buttons — solid teal with hover darken
- NO uniform border-radius — use hierarchical scale from DESIGN.md
- NO default Recharts colors — use teal accent + zinc scale
- NO "Built for..." / "Designed for..." copy patterns
- Financial data always in JetBrains Mono with tabular-nums
- Green (#4ADE80) for positive, Red (#F87171) for negative — never reversed

---

## Django Admin Usage
- View/manage ingested companies and financial data
- Monitor ingestion status via IngestionLog (last updated, errors, records created)
- Manually trigger re-ingestion for specific tickers (--force --ticker AAPL)
- View pre-computed screener metrics
- Admin dashboard as internal ops tool

---

## Open Questions (Resolved)

| Question | Resolution |
|---|---|
| Claude API abuse prevention | 50 queries/day per session token + 3 req/min per IP + $5/day Anthropic cap |
| SEC EDGAR rate limiting | 10 req/sec with exponential backoff, idempotent resumable pipeline |
| yfinance reliability | Cache aggressively, serve stale with "Updated X ago" badge |
| Domain name | TBD — check availability |

---

## Success Criteria

- [ ] Live at a custom domain with SSL
- [ ] All 6 features working for S&P 500 companies
- [ ] AI copilot answers questions about any S&P 500 company's financials
- [ ] XBRL mapping resolves metrics for 95%+ of S&P 500 companies
- [ ] Page load under 2 seconds, Lighthouse score > 90
- [ ] Dark mode default, responsive down to mobile
- [ ] Graceful degradation when yfinance is unavailable
- [ ] Clean GitHub repo with README, architecture diagram, and clear commit history
- [ ] A hiring manager can use it for 60 seconds and understand the engineering depth

---

## Ship Order

1. **Data Pipeline** — ingest_companies + ingest_financials + update_prices + compute_metrics
2. **Django Models & Admin** — Company, FinancialFact, StockMetrics, IngestionLog
3. **API Layer** — DRF endpoints for all data
4. **Stock Search & Company Profile** — typeahead + detail page
5. **Financial Analysis Dashboard** — 10+ charts with Recharts
6. **Interactive Price Chart** — TradingView Lightweight Charts
7. **DCF Calculator** — with guardrails and sensitivity heatmap
8. **AI Financial Copilot** — Claude Sonnet streaming chat
9. **Stock Screener** — filterable metrics table
10. **Polish & Deploy** — loading skeletons, error states, responsive, CI/CD, custom domain

---

## What This Demonstrates (Resume Talking Points)

| Skill | Evidence |
|---|---|
| Authentication | JWT auth + Google OAuth, per-user rate limiting, protected endpoints |
| AI/LLM integration | Claude Sonnet with structured financial context, streaming SSE, smart context pruning, rate limiting |
| Data engineering | Idempotent, resumable pipeline normalizing SEC XBRL data (with tag mapping) for 500 companies across 30 years |
| API design | DRF APIs with dynamic filtering, computed fields, pagination, yfinance proxy with caching |
| Database design | Financial time-series schema, pre-computed metrics, XBRL normalization, ingestion tracking |
| Background processing | Management commands with SEC rate limiting, exponential backoff, error handling, incremental updates |
| Complex querying | Screener with multi-field dynamic filtering + sorting, select_related optimization |
| Django Admin | Custom admin for ingestion monitoring and data ops |
| Frontend | React with professional charting, streaming AI chat, responsive dark-mode design |
| Domain knowledge | Financial metrics, DCF valuation with guardrails, stock screening, XBRL taxonomy |
| DevOps | Docker, CI/CD, managed database, custom domain, SSL, graceful degradation |
