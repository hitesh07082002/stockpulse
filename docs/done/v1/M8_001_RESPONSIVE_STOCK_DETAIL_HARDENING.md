# M8_001: Responsive Stock Detail Hardening

**Prototype:** v1.0.0
**Milestone:** M8
**Workstream:** 001
**Date:** Mar 26, 2026
**Status:** DONE
**Priority:** P0 — Production-grade responsive stock-detail architecture and verification
**Depends on:** [DESIGN.md](../../DESIGN.md), [plan.md](../../plan.md)

---

## 1.0 Goal

**Status:** DONE

Make the existing stock-detail experience fully responsive and production-grade without rewriting the whole frontend or changing the current visual direction.

**Dimensions:**
- 1.1 DONE Keep the current StockPulse visual language and overall UI direction.
- 1.2 DONE Make stock-detail surfaces intentional across mobile, tablet, and desktop.
- 1.3 DONE Replace page-local responsive logic with shared stock-detail primitives where repetition exists.
- 1.4 DONE Keep existing backend contracts, route structure, and tab scope intact.

---

## 2.0 Scope

**Status:** DONE

### 2.1 In Scope

**Status:** DONE

**Dimensions:**
- 2.1.1 DONE [StockDetailPage.jsx](/Users/hiteshsadhwani/Desktop/StockPulse/frontend/src/pages/StockDetailPage.jsx) shell rhythm, sticky header behavior, and tab-body spacing.
- 2.1.2 DONE [PriceTab.jsx](/Users/hiteshsadhwani/Desktop/StockPulse/frontend/src/components/tabs/PriceTab.jsx) responsive toolbar, readout, chart frame, and optional volume behavior.
- 2.1.3 DONE [ValuationTab.jsx](/Users/hiteshsadhwani/Desktop/StockPulse/frontend/src/components/tabs/ValuationTab.jsx) mobile hierarchy, assumptions panel, summary cards, and projection chart.
- 2.1.4 DONE Shared chart and stock-detail responsive primitives needed by those surfaces.
- 2.1.5 DONE Mobile and tablet Playwright coverage for Price and DCF usability.

### 2.2 Follow-On Audit

**Status:** DONE

**Dimensions:**
- 2.2.1 DONE Audit [FinancialsTab.jsx](/Users/hiteshsadhwani/Desktop/StockPulse/frontend/src/components/tabs/FinancialsTab.jsx) for alignment with the shared primitives created here.
- 2.2.2 DONE Audit [OverviewTab.jsx](/Users/hiteshsadhwani/Desktop/StockPulse/frontend/src/components/tabs/OverviewTab.jsx) and [AITab.jsx](/Users/hiteshsadhwani/Desktop/StockPulse/frontend/src/components/tabs/AITab.jsx) for overflow, density, and shell consistency after the stock-detail system changes.

---

## 3.0 Design Contract Alignment

**Status:** DONE

This workstream depends on strengthening the design source of truth before implementation spreads more responsive rules across code.

**Dimensions:**
- 3.1 DONE Refine [DESIGN.md](../../DESIGN.md) with stock-detail responsive rules, chart header behavior, and mobile hierarchy expectations.
- 3.2 DONE Lock chart height behavior by breakpoint for Price and DCF surfaces.
- 3.3 DONE Lock Price tab volume semantics and presentation rules so optional volume remains understandable.
- 3.4 DONE Lock DCF workspace hierarchy so mobile behaves as summary-first rather than compressed desktop.

---

## 4.0 Frontend Architecture

**Status:** DONE

### 4.1 Shared Surface Primitives

**Status:** DONE

**Dimensions:**
- 4.1.1 DONE Create a shared stock-detail section surface primitive for consistent spacing, border treatment, and vertical rhythm.
- 4.1.2 DONE Create a shared metric summary grid primitive that adapts cleanly across mobile, tablet, and desktop.
- 4.1.3 DONE Create a shared chart frame and toolbar pattern for titles, toggles, readouts, and stale badges.
- 4.1.4 DONE Create a shared form stack pattern for dense but touch-friendly assumption controls.

### 4.2 Page Responsibilities

**Status:** DONE

**Dimensions:**
- 4.2.1 DONE [StockDetailPage.jsx](/Users/hiteshsadhwani/Desktop/StockPulse/frontend/src/pages/StockDetailPage.jsx) owns shell concerns only: sticky header, tab rail, and tab-body container rules.
- 4.2.2 DONE Individual tabs consume shared layout primitives rather than redefining their own page-level spacing and chart sizing.
- 4.2.3 DONE Fixed pixel heights stop being the sole responsive strategy for stock-detail charts and skeletons.

---

## 5.0 Surface Rebuild Sequence

**Status:** DONE

### 5.1 Price Surface

**Status:** DONE

**Dimensions:**
- 5.1.1 DONE Rework the range selector, stale badge, volume toggle, and readout into a mobile-first chart header.
- 5.1.2 DONE Replace the fixed chart-height approach with breakpoint-driven responsive sizing.
- 5.1.3 DONE Keep volume optional and understandable, with no confusing axis-badge presentation.
- 5.1.4 DONE Verify no horizontal overflow at phone widths.

### 5.2 Valuation Surface

**Status:** DONE

**Dimensions:**
- 5.2.1 DONE Rebuild the DCF hierarchy so summary cards and guardrails lead on mobile.
- 5.2.2 DONE Keep assumption controls full-width and touch-friendly on small screens.
- 5.2.3 DONE Make the projection chart responsive without degrading readability.
- 5.2.4 DONE Preserve the serious analyst-tool feel without shipping a compressed desktop layout on phone.

### 5.3 Stock Detail Shell

**Status:** DONE

**Dimensions:**
- 5.3.1 DONE Tighten stock-detail section spacing so tabs feel like one coherent system.
- 5.3.2 DONE Keep horizontal tab navigation usable without letting the page body overflow.
- 5.3.3 DONE Ensure the sticky company header remains stable while tab content changes density.

---

## 6.0 Verification

**Status:** DONE

**Dimensions:**
- 6.1 DONE Playwright adds at least one mobile project and one tablet project for stock-detail responsive coverage.
- 6.2 DONE Price tab checks include toolbar usability, chart visibility, and zero horizontal overflow on phone widths.
- 6.3 DONE Valuation tab checks include summary-card readability, assumption-input usability, and projection-chart visibility on phone widths.
- 6.4 DONE Existing desktop smoke coverage continues to pass after the responsive refactor.
- 6.5 DONE Final `qa` and `design-review` passes confirm the rebuilt surfaces are shippable.

---

## 7.0 Acceptance Criteria

**Status:** DONE

- [x] 7.1 Stock-detail tabs feel intentional on mobile, tablet, and desktop rather than like squeezed desktop screens.
- [x] 7.2 Price and DCF tabs have no horizontal overflow at common phone widths.
- [x] 7.3 Price chart controls, DCF mode toggles, and assumption inputs stay comfortably usable at 44px+ touch targets on mobile.
- [x] 7.4 Responsive behavior is encoded in shared primitives and documented rules, not scattered magic numbers.
- [x] 7.5 Playwright covers Price and DCF responsive behavior on desktop plus at least mobile and tablet.

---

## 8.0 Out of Scope

- Whole-frontend rewrite
- Backend API changes for this workstream
- New product features beyond responsive hardening
- Redesigning StockPulse into a different aesthetic direction
