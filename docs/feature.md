# StockPulse Feature Specification

**Status:** V1 locked feature set  
**Date:** Mar 22, 2026  
**Source docs:** [`spec.md`](./spec.md), [`plan.md`](./plan.md), [`DESIGN.md`](./DESIGN.md), [`cicd.md`](./cicd.md)

## Product Promise

Search a company, understand its business and financial trajectory quickly, inspect price and valuation context, and ask follow-up questions grounded in the same structured data, with general financial context used when it clarifies the answer.

This is a research product, not a brokerage product and not a trading terminal.

## Primary Audience

- public users who want a clean stock research experience
- hiring managers evaluating product taste and engineering depth

## Core Routes

- `/`
- `/stock/:ticker`
- `/screener`
- `/about`

## V1 Features

### 1. Landing and Search

Purpose:
- get users into a company quickly

Includes:
- dominant search field
- typeahead by ticker and company name
- quick picks
- trust cues about methodology and data source

Does not include:
- marketing hero
- live market movers grid
- social proof bloat

### 2. Stock Detail Shell

Purpose:
- hold the full research workflow in one place

Tabs:
- Overview
- Financials
- Price
- Valuation
- AI

Rules:
- company header stays persistent
- stale/loading/error states are mandatory on every tab
- Financials is the hero tab

### 3. Overview

Purpose:
- summarize the company fast

Includes:
- key metrics
- quote and day change
- business context
- fast scan cards driven by `MetricSnapshot`
- overview metrics include margin, growth, free-cash-flow, and ROE context from the latest snapshot

### 4. Financials

Purpose:
- make the company story obvious quickly

Includes:
- normalized annual and quarterly financial series
- derived margin, free-cash-flow, and ROE chart series when the raw SEC facts support them
- strong default chart choices
- trust-building tables below the visual story
- metric switching without dashboard clutter

This is the hero feature of the product.

### 5. Price

Purpose:
- give price context without turning the app into trader software

Includes:
- line chart for all ranges
- adjusted close as the default line series
- optional volume bars
- SMA overlays
- freshness / stale state
- server-backed range cache with stale fallback
- `lightweight-charts` presentation for the dedicated price surface
- range-based downsampling: daily for short ranges, weekly for `5Y`, monthly for `MAX`

Does not include:
- candlesticks in V1
- dense drawing tools
- trading-terminal controls

### 6. Valuation

Purpose:
- connect business understanding to a fair-value workflow

Includes:
- Qualtrim-style serious-but-approachable DCF
- `Earnings` / `Cash Flow` mode toggle
- fair value per share
- annualized return versus current price, with total return shown as supporting context
- editable core assumptions
- 5-year projection chart
- summary result cards
- warnings for bad-fit sectors or weak data
- financial-sector caution warning in `Cash Flow` mode instead of a hard not-applicable state
- guardrails for negative earnings, negative free cash flow, and missing shares outstanding
- `Recharts`-style dashboard visuals for the valuation workspace

Prefilled assumptions:
- growth rate
- appropriate terminal multiple
- desired return

Input model:
- users normally enter 3 assumptions
- the prefilled current earnings or current free cash flow per share can also be edited, making it an optional 4th input

Does not include:
- saved models
- advanced dilution trees
- spreadsheet-clone complexity

### 7. Screener

Purpose:
- let users narrow the universe without stealing focus from the stock page

Includes:
- focused V1 filter set:
  - sector (using exact GICS sector names)
  - industry
  - market cap
  - PE
  - revenue growth
  - gross margin
  - operating margin
  - debt-to-equity
  - positive free-cash-flow toggle
- primary filters visible by default, with secondary filters behind a `More filters` expand
- curated results table
- sortable columns
- API-driven filtering and sorting over `MetricSnapshot`
- mobile filter sheet and stacked result cards on smaller screens

Does not include:
- saved screens
- custom columns
- advanced boolean filter builders

### 8. AI Copilot

Purpose:
- explain the numbers already visible in StockPulse and add concise financial context when helpful

Includes:
- per-company copilot
- bounded follow-up questions from the active browser session
- SSE streaming responses
- answers grounded primarily in structured StockPulse data, with general financial knowledge allowed for context and explanation
- historical annual and quarterly StockPulse series explicitly treated as reported results, not projections
- honesty about sparse or weak coverage
- explicit quota, timeout, empty-response, and provider-unavailable states
- quota refunds when the provider fails before returning any answer text
- no empty assistant bubble after failed streams
- anonymous quota exhaustion -> sign-in upgrade path

Limits:
- anonymous: 10 prompts/day
- authenticated: 50 prompts/day
- burst backstop: 3 prompts/minute per IP

Does not include:
- chat-first product positioning
- cross-company RAG
- filing-text search

### 9. Authentication

Purpose:
- unlock higher AI usage and future user-owned features without gating browsing

Includes:
- Google sign-in as the primary auth path through a backend-managed redirect/callback flow
- email/password fallback with email verification required before first login
- email-based password reset and recovery
- case-insensitive unique email enforcement at the database boundary
- secure cookie-based auth
- password changes invalidating pre-reset JWT cookie sessions immediately
- frontend auth context bootstrapped through `/api/auth/session/`, including a refresh-session hint so fully anonymous browsing does not spam failed refresh attempts
- login/register modal or drawer
- verification resend + confirm flows on the frontend
- shell-level sign-in entry points in the global header and AI tab

Does not include:
- gating public research pages
- watchlists in V1
- saved chats in V1

### 10. About / Methodology

Purpose:
- explain why the data can be trusted

Includes:
- SEC and quote-source notes
- normalization explanation
- methodology and provenance language
- architecture summary in plain English

## Explicitly Out of Scope

- portfolio tracking
- saved watchlists
- saved conversations
- real-time streaming quotes
- news feeds
- earnings calendars
- macro dashboards
- vector search
- brokerage workflows

## V1 Success Bar

V1 is successful when:
- a user can search and open any covered S&P 500 company
- the Financials tab is obviously the strongest surface
- Valuation feels credible beside Financials
- AI feels helpful but secondary
- the whole app feels coherent, not feature-stuffed
