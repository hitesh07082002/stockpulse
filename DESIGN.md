# Design System — StockPulse

## Product Context
- **What this is:** AI-powered stock analysis platform with 30 years of SEC financial data
- **Who it's for:** Retail investors (product), hiring managers reviewing a portfolio project (audience)
- **Space/industry:** Fintech / stock analysis (peers: TradingView, Macrotrends, Simply Wall St)
- **Project type:** Data-heavy web app / financial dashboard

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian — data-first, function-first, but refined
- **Decoration level:** Minimal — typography and data visualization carry everything
- **Mood:** Linear's restraint applied to financial data. Professional, precise, modern. The charts and numbers ARE the decoration. No gratuitous ornamentation.
- **Reference sites:** TradingView (charting UX), Linear (dark mode SaaS), Vercel (typography/spacing)

## Typography
- **Display/Hero:** Satoshi (Fontshare) — modern geometric sans with personality. Confident, clean. For logo, section headers, hero text.
- **Body:** DM Sans (Google Fonts) — highly legible at all sizes, clean, professional. For paragraphs, descriptions, UI labels.
- **UI/Labels:** DM Sans (same as body)
- **Data/Tables:** JetBrains Mono (Google Fonts) — monospaced with built-in tabular-nums. Financial numbers align perfectly, columns are scannable. Bloomberg Terminal vibe, modern execution.
- **Code:** JetBrains Mono
- **Loading:**
  - Satoshi: `https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap`
  - DM Sans + JetBrains Mono: Google Fonts
- **Scale:**
  - Display XL: 56px / 3.5rem (hero headings)
  - Display LG: 36px / 2.25rem (page titles)
  - Display MD: 28px / 1.75rem (section titles)
  - Display SM: 20px / 1.25rem (card titles)
  - Body LG: 18px / 1.125rem (lead paragraphs)
  - Body: 16px / 1rem (default body)
  - Body SM: 14px / 0.875rem (UI labels, descriptions)
  - Caption: 13px / 0.8125rem (secondary text, table cells)
  - Micro: 12px / 0.75rem (badges, timestamps)
  - Data XL: 24px (hero metrics)
  - Data LG: 20px (stat card values)
  - Data MD: 16px (inline data)
  - Data SM: 13px (table cells)
  - Data XS: 11px (chart labels, axis labels)

## Color

### Approach: Restrained — one accent + neutrals + financial semantic colors

### Primary
- **Teal 400:** #2DD4BF — hover/active states on dark backgrounds
- **Teal 500:** #14B8A6 — primary accent (dark mode)
- **Teal 600:** #0D9488 — primary accent (light mode)
- **Teal 700:** #0F766E — hover/active states on light backgrounds
- **Accent muted (dark):** rgba(20, 184, 166, 0.15) — backgrounds, badges
- **Accent muted (light):** rgba(20, 184, 166, 0.10) — backgrounds, badges

### Neutrals — Zinc scale
- **50:** #FAFAFA — light mode base
- **100:** #F4F4F5 — light mode elevated
- **200:** #E4E4E7 — light mode borders, hover
- **300:** #D4D4D8 — light mode border hover
- **400:** #A1A1AA — secondary text (dark mode)
- **500:** #71717A — tertiary text
- **600:** #52525B — secondary text (light mode)
- **700:** #3F3F46 — dark mode hover
- **800:** #27272A — dark mode elevated, borders
- **900:** #18181B — dark mode surface
- **950:** #09090B — dark mode base

### Financial Signals
- **Up/Positive (dark):** #4ADE80 (green-400)
- **Up/Positive (light):** #16A34A (green-600)
- **Down/Negative (dark):** #F87171 (red-400)
- **Down/Negative (light):** #DC2626 (red-600)

### Semantic
- **Success:** #22C55E — positive outcomes, profitable indicators
- **Warning:** #F59E0B — delayed data, approaching limits
- **Error:** #EF4444 — failures, data fetch errors
- **Info:** #3B82F6 — informational notes, methodology explanations

### Dark Mode (default)
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

### Light Mode
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

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — dense enough for data tables, breathing room for dashboards
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
- **Approach:** Grid-disciplined — card-based metrics, tabbed stock detail pages, sidebar for screener filters
- **Grid:** 12 columns, 16px gutter
  - Mobile (< 640px): 4 columns
  - Tablet (640–1024px): 8 columns
  - Desktop (> 1024px): 12 columns
- **Max content width:** 1280px
- **Border radius:**
  - sm: 4px — inputs, small elements
  - md: 6px — cards, buttons
  - lg: 8px — larger cards, modals
  - xl: 12px — page-level containers
  - full: 9999px — badges, pills

## Motion
- **Approach:** Minimal-functional — only transitions that aid data comprehension
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:**
  - micro: 100ms — hover states, brightness shifts
  - short: 150ms — tab switches, fades
  - medium: 250ms — chart data loading, panel transitions
  - long: 400ms — page transitions (use sparingly)
- **Rules:**
  - NO scroll-triggered animations
  - NO entrance bounce/slide animations
  - NO decorative motion
  - Chart data transitions use ease-out for loading feel
  - Financial data should feel stable and trustworthy

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| Mar 20, 2026 | Initial design system created | Created by /design-consultation based on competitive research (TradingView, Linear, Vercel, Macrotrends) |
| Mar 20, 2026 | Teal #14B8A6 as primary accent | Distinctive — no major fintech uses teal. Doesn't conflict with red/green market signals. Reads as "analytical precision." |
| Mar 20, 2026 | JetBrains Mono for financial data | Monospaced tabular-nums for perfect column alignment. Bloomberg Terminal vibe with modern execution. |
| Mar 20, 2026 | Satoshi for display type | Geometric sans with personality. More distinctive than Inter/Roboto defaults. Signals design taste. |
| Mar 20, 2026 | Dark mode default (#09090B) | Linear/Vercel-shade near-black. Every serious financial analysis tool is dark mode. NOT generic navy-dark. |
