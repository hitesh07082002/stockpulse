# StockPulse V1 Specification

**Prototype:** v1.0.0  
**Date:** Mar 22, 2026  
**Status:** IN_PROGRESS  
**Priority:** P0 — Canonical product specification  
**Source docs:** [`plan.md`](./plan.md), [`DESIGN.md`](./DESIGN.md), [`architecture.md`](./architecture.md), [`feature.md`](./feature.md), [`techstack.md`](./techstack.md), [`cicd.md`](./cicd.md)

## 1.0 Product Summary

StockPulse V1 is a public-first stock research product for S&P 500 companies. It should feel like a cleaner, faster, more premium fundamentals research tool: search a company, understand the business quickly, inspect financial and valuation context, and ask grounded follow-up questions from the same structured data.

**Dimensions:**
- 1.1 DONE Public browsing is open by default.
- 1.2 DONE The stock detail page is the hero surface.
- 1.3 DONE The Financials tab is the hero tab.
- 1.4 DONE AI is a supporting research layer, not the main product.
- 1.5 DONE The app optimizes for trust, clarity, and speed over breadth.

## 2.0 Locked V1 Decisions

These are the product and engineering choices that should be treated as fixed unless the product direction changes.

**Dimensions:**
- 2.1 DONE Launch scope is the S&P 500, with a 25-company seed set used for early development and verification.
- 2.2 DONE Authentication is in V1: Google sign-in is primary, with email/password as fallback.
- 2.3 DONE AI quotas are `10/day` anonymous and `50/day` authenticated, plus a `3/minute` IP burst backstop.
- 2.4 DONE AI budget is enforced in-product with a hard daily cap and database-backed accounting.
- 2.5 DONE Price charts are line charts only in V1, using adjusted close by default.
- 2.6 DONE V1 intentionally uses two charting libraries: `Recharts` for Financials and Valuation, `lightweight-charts` for Price.
- 2.7 DONE The Valuation tab is a Qualtrim-like DCF workflow with `Earnings` and `Cash Flow` modes and three primary assumptions, plus an editable current metric as an optional fourth input.
- 2.8 DONE V1 background work runs on a single scheduled worker. Celery and Redis are out unless documented SLAs fail twice in normal operation or durable async jobs become a real product need.
- 2.9 DONE Watchlists, saved chats, real-time streaming quotes, news, and vector search are out of V1.

## 3.0 Core Product Surfaces

**Dimensions:**
- 3.1 DONE `/` is a tool-first landing page centered on search.
- 3.2 DONE `/stock/:ticker` contains Overview, Financials, Price, DCF Calculator, and AI tabs.
- 3.3 DONE `/screener` is in V1, but with a focused filter set and curated table.
- 3.4 DONE `/about` explains methodology, provenance, and architecture in plain language.
- 3.5 DONE Every major surface must have loading, empty, stale, and error states.

## 4.0 System Contract

**Dimensions:**
- 4.1 DONE SEC normalization is the product-critical layer and feeds charts, screener, valuation, and AI.
- 4.2 DONE PostgreSQL is the source of truth for canonical facts, snapshots, price cache state, usage counters, and AI budget state.
- 4.3 DONE Screener reads from `MetricSnapshot`, not heavy request-time joins on raw facts.
- 4.4 DONE AI is grounded only in structured StockPulse data, not filing text or vector retrieval.
- 4.5 DONE Authentication uses secure cookie-based auth with backend-managed Google redirect/callback.
- 4.6 DONE Raw SEC payloads live in a bounded cold audit store, not on the hot company row.

## 5.0 Milestones

The implementation sequence is defined in detail in [`plan.md`](./plan.md).

**Dimensions:**
- 5.1 DONE M1 — Foundation: standard entry points, tests, fixtures, and normalization fixture coverage
- 5.2 DONE M2 — Ingestion and Canonical Data: schema cut, canonical ingestion, full 500-company rebuild, quotes, snapshots, cached replay from retained raw payloads, and a passing launch coverage audit artifact are landed
- 5.3 DONE M3 — Public Read APIs and Stock Detail Shell: landing, company detail, overview, and Financials hero
- 5.4 DONE M4 — Price, Valuation, and Screener: cache-backed price ranges with stale fallback, guarded Qualtrim-style DCF, and a focused `MetricSnapshot` screener
- 5.5 DONE M5 — Authentication: secure cookies, `/api/auth/session/` bootstrap, Google-first auth flow, frontend auth context, and shell auth modal
- 5.6 PENDING M6 — AI Copilot: grounded context assembly, quota enforcement, spend enforcement, SSE UI
- 5.7 PENDING M7 — Hardening and Deploy: scheduled worker, production config, accessibility, performance, docs polish

## 6.0 Verification and Launch Bar

**Dimensions:**
- 6.1 DONE `make lint`, `make test`, and `make build` pass on the current rewrite branch.
- 6.2 DONE Playwright smoke covers landing -> search -> stock detail -> Financials tab rendering canonical data.
- 6.3 DONE Price range selection and screener filter-to-company flows pass Playwright smoke.
- 6.4 PENDING Google sign-in and anonymous-to-authenticated AI upgrade flows must pass end to end.
- 6.5 DONE Normalization fixtures prove deterministic handling of amendments, duplicates, mixed units, and derived quarters.
- 6.6 DONE M2 local/dev data was reset after the schema cut and rebuilt from the canonical pipeline without compatibility glue.
- 6.7 PENDING Scheduled-worker SLAs must hold under normal V1 load.
- 6.7 DONE A documented S&P 500 coverage audit exists at [`docs/audits/sp500-launch-coverage-2026-03-22.md`](./docs/audits/sp500-launch-coverage-2026-03-22.md), passes the `95%` gate, and treats `gross_profit` and `gross_margin` as conditional metrics based on retained SEC payload applicability.

## 7.0 Source of Truth

If docs differ, use this order:

1. [`spec.md`](./spec.md) for the top-level product and launch contract
2. [`plan.md`](./plan.md) for execution order, milestones, and acceptance gates
3. [`DESIGN.md`](./DESIGN.md) for visual and interaction decisions
4. [`architecture.md`](./architecture.md) for system shape and data flow
5. [`feature.md`](./feature.md) for route and feature boundaries
6. [`techstack.md`](./techstack.md) for concrete technology choices
7. [`cicd.md`](./cicd.md) for CI/CD, release, and deployment policy

## 8.0 Out of Scope

- saved watchlists and portfolios
- saved AI chats
- real-time streaming quotes
- news, earnings calendars, and macro overlays
- vector search or filing-text retrieval
- candlestick charts in V1
- spreadsheet-grade valuation tooling
