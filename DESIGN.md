# Design System — StockPulse

**Version:** Scratch-build V1
**Date:** Mar 22, 2026
**Scope:** Visual and interaction source of truth for the rewrite

## Product Context
- **What this is:** Public-first stock analysis platform built on normalized SEC financial data
- **Who it's for:** Retail investors who want clarity, and hiring managers evaluating product taste plus engineering depth
- **Project type:** Data-heavy web app / financial dashboard
- **Primary product promise:** Search a company, understand its business and financial trajectory quickly, then ask grounded follow-up questions

## Product Principles
- **Search before storytelling:** The first screen should get people into a company, not into a marketing funnel.
- **Numbers before adjectives:** Use data, labels, and trend framing instead of hype copy.
- **Trust beats spectacle:** When in doubt, choose legibility, provenance, and calm surfaces over visual flair.
- **Density without clutter:** The UI should feel information-rich, not crowded.
- **One main question per surface:** Every page, panel, card, and chart should answer one clear question.
- **Low-friction auth:** Browsing stays open, but sign-in should be available wherever account value becomes relevant, with Google sign-in included in V1.

## Aesthetic Direction
- **Direction:** Industrial / utilitarian / precise
- **Mood:** Linear restraint applied to a financial terminal, but warmer and more readable
- **Decoration level:** Minimal. Typography, hierarchy, and charts do the visual work.
- **Reference energy:** TradingView for chart seriousness, Linear for discipline, Vercel for typography and spacing

## Typography
- **Display:** Satoshi (Fontshare)
- **Body/UI:** DM Sans
- **Data/Tables:** JetBrains Mono
- **Code:** JetBrains Mono
- **Loading:**
  - Satoshi: `https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap`
  - DM Sans + JetBrains Mono: Google Fonts

### Type Scale
- **Display XL:** 56px / 3.5rem
- **Display LG:** 36px / 2.25rem
- **Display MD:** 28px / 1.75rem
- **Display SM:** 20px / 1.25rem
- **Body LG:** 18px / 1.125rem
- **Body:** 16px / 1rem
- **Body SM:** 14px / 0.875rem
- **Caption:** 13px / 0.8125rem
- **Micro:** 12px / 0.75rem
- **Data XL:** 24px
- **Data LG:** 20px
- **Data MD:** 16px
- **Data SM:** 13px
- **Data XS:** 11px

### Type Usage Rules
- All primary numeric values use JetBrains Mono.
- Percentage changes, chart axis labels, table cells, and quote timestamps use JetBrains Mono.
- Long-form descriptive copy uses DM Sans and should stay sparse.
- Satoshi is reserved for page titles, company tickers, section titles, and major card headings.

## Color

### Primary Accent
- **Teal 400:** `#2DD4BF`
- **Teal 500:** `#14B8A6`
- **Teal 600:** `#0D9488`
- **Teal 700:** `#0F766E`
- **Accent muted dark:** `rgba(20, 184, 166, 0.15)`
- **Accent muted light:** `rgba(20, 184, 166, 0.10)`

### Neutrals
- **50:** `#FAFAFA`
- **100:** `#F4F4F5`
- **200:** `#E4E4E7`
- **300:** `#D4D4D8`
- **400:** `#A1A1AA`
- **500:** `#71717A`
- **600:** `#52525B`
- **700:** `#3F3F46`
- **800:** `#27272A`
- **900:** `#18181B`
- **950:** `#09090B`

### Financial Signals
- **Positive dark:** `#4ADE80`
- **Positive light:** `#16A34A`
- **Negative dark:** `#F87171`
- **Negative light:** `#DC2626`
- **Warning:** `#F59E0B`
- **Error:** `#EF4444`
- **Info:** `#3B82F6`

### Dark Mode Tokens
```css
--bg-base: #09090B;
--bg-surface: #18181B;
--bg-elevated: #27272A;
--bg-hover: #3F3F46;
--border: #27272A;
--border-hover: #3F3F46;
--text-primary: #FAFAFA;
--text-secondary: #A1A1AA;
--text-tertiary: #71717A;
--text-inverse: #09090B;
--accent: #14B8A6;
--accent-hover: #2DD4BF;
```

### Light Mode Tokens
```css
--bg-base: #FAFAFA;
--bg-surface: #FFFFFF;
--bg-elevated: #F4F4F5;
--bg-hover: #E4E4E7;
--border: #E4E4E7;
--border-hover: #D4D4D8;
--text-primary: #09090B;
--text-secondary: #52525B;
--text-tertiary: #71717A;
--text-inverse: #FAFAFA;
--accent: #0D9488;
--accent-hover: #0F766E;
```

### Chart Tokens
```css
--chart-primary: #14B8A6;
--chart-secondary: #A1A1AA;
--chart-positive: #4ADE80;
--chart-negative: #F87171;
--chart-forecast: #F59E0B;
--chart-grid: rgba(161, 161, 170, 0.14);
--chart-axis: #71717A;
--chart-tooltip-bg: #18181B;
--chart-tooltip-border: #27272A;
--chart-crosshair: rgba(250, 250, 250, 0.22);
```

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable, leaning dense on data surfaces
- **Scale:**
  - 2xs: 2px
  - xs: 4px
  - sm: 8px
  - md: 16px
  - lg: 24px
  - xl: 32px
  - 2xl: 48px
  - 3xl: 64px

## Layout
- **Grid:** 12 columns with 16px gutter
- **Mobile:** 4 columns
- **Tablet:** 8 columns
- **Desktop:** 12 columns
- **Max width:** 1280px
- **Shell structure:** sticky top app bar, constrained content column, shallow footer
- **Border radius:**
  - sm: 4px
  - md: 6px
  - lg: 8px
  - xl: 12px
  - full: 9999px

## Motion
- **Approach:** Minimal-functional
- **Micro:** 100ms
- **Short:** 150ms
- **Medium:** 250ms
- **Long:** 400ms
- **Rules:**
  - No decorative motion
  - No bounce, parallax, or scroll-trigger reveals
  - Use fades and brightness shifts, not movement-heavy transitions
  - Chart updates should feel stable and quiet

## Site Structure and Content Hierarchy

```text
/  (Landing)
├── [1st] Search bar — dominant, above fold, owns the page
├── [2nd] Quick pick tickers — immediate entry points into coverage
└── [3rd] Trust statement — one line about coverage and methodology

/stock/:ticker  (Stock Detail)
├── [PERSISTENT] Company header: ticker > name > quote > change > sector
├── Tab bar: Overview | Financials | Price | DCF Calculator | AI
│
├── Overview tab
│   ├── [1st] Key metric cards (4-6): PE, market cap, revenue, margins
│   ├── [2nd] Company description (when metadata is available)
│   └── [3rd] Sector and industry context
│
├── Financials tab (HERO — most substantial tab)
│   ├── [1st] Period toggle: Annual | Quarterly
│   ├── [2nd] Primary chart: Revenue + Net Income bars
│   ├── [3rd] Secondary charts: margins, cash flow, debt
│   └── [4th] Data table with full metric history
│
├── Price tab
│   ├── [1st] Range selector: 1M 3M 6M 1Y 5Y MAX
│   ├── [2nd] Price line chart (lightweight-charts, adjusted close)
│   └── [3rd] Stale data badge near chart header (if applicable)
│
├── Valuation tab
│   ├── [1st] Mode toggle: Earnings | Cash Flow
│   ├── [2nd] Summary result cards (implied value, annualized return vs current, entry price)
│   ├── [3rd] Editable assumptions (growth rate, terminal multiple, desired return)
│   ├── [4th] 5-year projection chart
│   └── [5th] Guardrail warnings (financial sector, negative earnings/FCF, missing data)
│
└── AI tab
    ├── [1st] Suggested prompts (3-4 concrete, numeric questions)
    ├── [2nd] Response stream area
    ├── [3rd] Chat input (sticky bottom on mobile)
    └── [4th] Quota indicator (subtle, non-alarming)

/screener
├── [1st] Filter controls (sidebar on desktop, bottom sheet on mobile)
├── [2nd] Results table with sortable columns
└── [3rd] Result count or empty state

/about
├── [1st] Methodology summary
├── [2nd] Data source provenance (SEC, yfinance)
└── [3rd] Architecture diagram
```

## Page Templates

### Landing Page
- Search sits above the fold and owns the page.
- Supporting content is lightweight: quick tickers and a one-line trust statement.
- The trust statement should be specific and factual, not marketing copy. Example tone: "Normalized SEC financial data for 500 S&P companies" or "Research 500 companies with real SEC filings and AI analysis." Avoid generic claims like "the best stock research tool."
- No live market movers grid in V1.

### Stock Detail
- Persistent company header at top.
- Tabs below header: Overview, Financials, Price, DCF Calculator, AI.
- The Financials tab is the hero tab and should feel more substantial than the rest.

### Screener
- Desktop: filter sidebar plus results table.
- Mobile: filters in a bottom sheet, results as stacked cards. Show primary filters (sector, market cap, PE, positive FCF toggle) by default; remaining filters behind a "More filters" expand.
- Sector options should use the exact GICS names shown in the data, not shortened aliases.
- V1 filter set stays focused: sector, industry, market cap, PE, revenue growth, gross margin, operating margin, debt-to-equity, and positive free-cash-flow toggle.
- No saved screens, custom columns, or advanced boolean filter builders in V1.

### About
- Quiet documentation page.
- Use diagrams, methodology notes, and source provenance instead of brand copy.

## Component Contract

### App Shell
- Header height should stay compact and calm.
- Brand mark is text-only in V1.
- Do not fill the shell with global badges, banners, or promo elements.
- Include a clear but quiet sign-in entry point in the header.

### Search
- Single primary field with strong focus treatment.
- Typeahead results should show ticker first, company name second.
- Keyboard navigation is mandatory.

### Company Header
- Ticker is the visual anchor.
- Quote and day change sit on the same line when space allows.
- Sector, industry, market cap, and freshness metadata sit below as supporting context.
- Freshness must be visible but quiet.

### Metric Cards
- Purpose: fast scanning, not dense explanation.
- Structure:
  - label
  - current value
  - delta or YoY change
  - small sparkline
- Use one strong number per card.
- Do not cram multiple metrics into one card.

### Tabs
- Tabs should look operational, not decorative.
- Active tab uses accent color and a hard underline.
- On mobile, tabs scroll horizontally without wrapping into two rows. A subtle gradient fade on the right edge signals that more tabs exist off-screen.

### Tables
- Numeric columns are right-aligned.

### Valuation Workspace
- The DCF surface should intentionally feel closer to Qualtrim than to a toy calculator.
- Structure the tab as an analyst workspace:
  - mode toggle: `Earnings` / `Cash Flow`
  - summary result cards
  - annualized return versus current price, with total return only as supporting context
  - editable assumptions
  - 5-year projection chart
  - short methodology or warning notes
- Prefill the current earnings or cash-flow metric from company data where possible, but keep it editable.
- Keep the assumption set compact and Qualtrim-like:
  - growth rate
  - appropriate terminal multiple
  - desired return
- The editable current metric acts as an optional fourth input when the prefilled value needs adjustment.
- The interface should feel closer to an assumption-driven calculator than to a full forecast model.
- The projection chart is the primary visual; sensitivity heatmaps are not part of V1.
- Avoid both extremes: no two-slider toy, and no spreadsheet-clone overload.
- No saved models, advanced dilution trees, or spreadsheet-style freeform grids in V1.
- Sector or data-quality warnings should be visible before the user trusts the output.
- Sticky headers on long tables.
- Use row dividers and hover states instead of zebra stripes.
- Missing values render as em dashes, not zeroes.

### Filter Controls
- Use compact selects, segmented pills, and min/max fields.
- Filters must read as tools, not form paperwork.
- On mobile, the filter sheet should feel native and easy to dismiss.

### Badges and Status Chips
- Use pills for freshness, positive/negative deltas, and warnings.
- Do not create rainbow badge systems.
- Accent is for selection and focus, not for every chip.

### AI Chat
- The AI panel should feel like an analyst console, not a consumer chat toy.
- Suggested prompts are short, concrete, and numeric.
- Response blocks should make cited numbers visually easy to scan.
- When logged out, the panel can show a soft sign-in upgrade path after free usage is exhausted.

### Authentication Surfaces
- Auth should feel operational, not like a separate marketing funnel.
- Prefer modal or drawer flows over standalone auth pages.
- Google sign-in is the primary auth action in V1.
- Email/password remains available as a secondary fallback flow.
- Logged-in state should be visible in the shell without taking over the page chrome.

## Data Visualization Contract

### General Rules
- Never put more than one primary series in accent color.
- Additional series should use zinc or semantic colors only when meaningfully different.
- Missing data creates gaps. Never interpolate across missing periods.
- Zero baselines must be visible for series that can go negative.
- Tooltips use elevated surfaces with tight spacing and JetBrains Mono values.
- Legends belong above or beside charts, not below the fold.

### Financial Charts
- **Absolute metrics** like revenue, net income, FCF, debt, and cash use bars by default.
- **Ratio metrics** like margins, ROE, and debt-to-equity use lines.
- **Negative values** extend below a visible zero line and switch to negative color.
- **Derived values** may be shown with a dashed stroke or subtle provenance marker.
- **Quarterly mode** should be denser but still readable; no marker on every point.

### Sparklines
- Line-only, no axes, no point markers.
- One metric per sparkline.
- Use accent for neutral series, green/red only when direction is the message.

### Price Chart
- Range selector lives above the chart.
- V1 uses a line chart for every range.
- The default line series uses adjusted close, not raw close.
- Optional volume bars may sit below the main price series when they improve context without crowding the view.
- SMA overlays use neutral secondary lines, not accent.
- Stale data badge belongs near the chart header, not inside the plot area.

### DCF Heatmap
- Use a restrained two-direction palette: muted green for upside, muted red for downside.
- The center or baseline state should feel neutral, not overly saturated.
- No rainbow gradients.

### Axes and Gridlines
- Axis labels use JetBrains Mono at Data XS size.
- Gridlines are subtle and low-contrast.
- The zero line is slightly stronger than ordinary gridlines.
- Date density should reduce on mobile; never force unreadable tick labels.

### Tooltip Content Order
1. Date or period
2. Main series value
3. Secondary values
4. Provenance note only when relevant, such as derived or stale

## Interaction State Contract

### General Rules
- Use skeletons shaped like the final content. No centered spinners for page-level loads.
- Empty states should be calm and factual. No cute copy.
- Errors should tell the user what failed and whether retrying could help.
- Stale is a warning state, not an error state. Show last-updated time.

### Per-Feature State Table

```text
FEATURE              | LOADING              | EMPTY                           | ERROR                          | STALE
---------------------|----------------------|---------------------------------|--------------------------------|----------------------------
Search typeahead     | Subtle spinner in    | “No companies match”            | Silent — show no results       | n/a
                     | input field          |                                 |                                |
Company header       | Skeleton: ticker +   | n/a (404 → error page)          | “Company not found” + back     | Quote: amber badge +
                     | quote placeholder    |                                 | link to search                 | “Updated X min ago”
Overview tab         | 4-6 skeleton cards   | “Overview data not yet          | “Failed to load overview.      | n/a (reads snapshot)
                     |                      | available for [TICKER]”         | Try refreshing.”               |
Financials tab       | Skeleton chart +     | “No financial data filed with   | “Financial data unavailable.   | n/a (reads canonical facts)
                     | skeleton table       | the SEC for [TICKER]”           | Try again later.”              |
Price tab            | Skeleton chart area  | “No price history available”    | “Price data unavailable.       | Amber “Stale” badge +
                     |                      |                                 | Retry.”                        | “Last updated [time]”
Valuation tab        | Skeleton cards +     | “Insufficient data for          | “Valuation inputs unavailable” | n/a
                     | skeleton chart       | valuation” (missing inputs)     |                                |
                     |                      | “Not applicable for financial   |                                |
                     |                      | sector companies” (guardrail)   |                                |
AI tab               | Streaming dots or    | Suggested prompts visible       | “AI service unavailable.       | n/a
                     | skeleton response    | (no conversation yet)           | Try again shortly.”            |
AI quota exhausted   | n/a                  | “You've used your 10 free       | n/a                            | n/a
  (anonymous)        |                      | prompts today. Sign in for      |                                |
                     |                      | 50 daily prompts.” + sign-in    |                                |
AI quota exhausted   | n/a                  | “Daily limit reached. Your      | n/a                            | n/a
  (authenticated)    |                      | prompts reset tomorrow.”        |                                |
AI budget exhausted  | n/a                  | “AI is temporarily unavailable  | n/a                            | n/a
  (global)           |                      | due to high demand. Try again   |                                |
                     |                      | tomorrow.”                      |                                |
Screener results     | Skeleton table rows  | “No companies match your        | “Screener unavailable.         | n/a (reads snapshot)
                     |                      | filters. Try broadening your    | Try again.”                    |
                     |                      | criteria.” + reset link         |                                |
Auth modal           | Button loading state | n/a                             | “Sign-in failed. Try again     | n/a
                     |                      |                                 | or use email/password.”        |
```

### AI Limits Display
- Anonymous users get 10 AI prompts per day.
- Authenticated users get 50 AI prompts per day.
- If the anonymous quota is exhausted, explain the limit clearly and offer sign-in for the higher authenticated allowance.
- A quiet short-window throttle should prevent obvious burst abuse without making normal usage feel punished.
- Logged-in users should see remaining usage in a subtle, non-alarming way.

## Responsive Contract

### Mobile
- Search remains accessible without excessive scrolling.
- Company header compresses into ticker, quote, change, and one row of metadata.
- Financial metric cards collapse to a 2x2 grid.
- AI input sticks to the bottom edge.
- Tables convert to cards when horizontal scroll would become painful.

### Tablet
- Preserve the density of desktop where possible.
- Avoid large empty gutters.

### Desktop
- Use width to improve scan speed, not to inflate whitespace.
- Financials tab should feel dashboard-like, not like a stretched phone view.

## Accessibility
- Minimum 44px touch targets
- WCAG AA contrast for text and controls
- Visible focus ring using teal outline
- Proper `tablist`, landmarks, labels, and keyboard support
- Charts require text summaries or table alternatives where needed

## User Journey — Emotional Arc

The primary user journey and the emotional design intent at each step:

```text
STEP | USER DOES                    | USER FEELS               | DESIGN SUPPORTS IT WITH
-----|------------------------------|--------------------------|------------------------------------
1    | Lands on /                   | "This is serious."       | No marketing hero. Search dominates.
     |                              | (5-sec visceral)         | Dark theme, clean typography, calm.
2    | Types a company name         | "This is fast."          | Instant typeahead. Ticker-first results.
     |                              |                          | Keyboard navigation works.
3    | Opens /stock/:ticker         | "I trust this data."     | Real SEC data. Freshness badge visible.
     |                              | (5-min behavioral)       | Quote with timestamp. No fake numbers.
4    | Browses Financials tab       | "This is comprehensive." | Multi-year charts. Bar + line combos.
     |                              |                          | JetBrains Mono numbers. Dense but clear.
5    | Checks Price tab             | "Clean and focused."     | One line, adjusted close, range selector.
     |                              |                          | No candlestick noise. Stale badge if needed.
6    | Tries Valuation tab          | "I can think with this." | Assumption inputs are few and clear.
     |                              |                          | Projection chart shows the consequence.
     |                              |                          | Guardrails prevent garbage output.
7    | Asks AI a question           | "It knows this company." | Grounded in the same data I just saw.
     |                              |                          | Admits gaps. Numeric citations are scannable.
8    | Hits anonymous quota         | "Fair enough."           | Clear limit. Sign-in gets me more.
     |                              | (not punished)           | Not a paywall — browsing stays open.
9    | Signs in with Google         | "That was easy."         | One click. Modal. Back to where I was.
     |                              |                          | Higher AI limit immediately available.
```

**Two audiences, one journey:**
- **Retail investor:** Completes steps 1-7, may never hit 8. Values: speed, trust, clarity.
- **Hiring manager / recruiter:** Skims steps 1-4 in under 60 seconds. Values: polish, taste, real data (not Lorem ipsum). The Financials tab is the "wow" moment — this is where engineering depth becomes visible.

## Anti-Slop Rules
- No marketing hero
- No gradient backgrounds
- No 3-column feature grid on the landing page
- No gradient buttons
- No oversized glassmorphism panels
- No default chart library palette
- No fake data placeholders in shipped UI
- No full-app login wall in V1
- No decorative icons inside every stat card

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| Mar 20, 2026 | Initial design system created | Established the tone and base tokens |
| Mar 20, 2026 | Teal as primary accent | Distinct from common fintech blues and does not conflict with market red/green |
| Mar 20, 2026 | JetBrains Mono for financial data | Improves scan speed and number alignment |
| Mar 20, 2026 | Dark mode as canonical theme | Better fit for a serious finance dashboard |
| Mar 22, 2026 | Added explicit data-viz contract | Prevents chart and table drift during the rewrite |
| Mar 22, 2026 | Restored low-friction auth to the V1 design | Keeps browsing public while supporting account-based AI upgrades |
