import React, { useState, useMemo } from 'react';
import { useDCFInputs } from '../../hooks/useStockData';

/* ────────────────────────────────────────────
   DCF Calculation
   ──────────────────────────────────────────── */

function computeDCF(fcf, growthRate, wacc, terminalGrowth, years, sharesOutstanding) {
  if (!fcf || !sharesOutstanding || wacc <= terminalGrowth) return null;

  let sumDiscounted = 0;
  let lastDiscounted = 0;

  for (let year = 1; year <= years; year++) {
    const projected = fcf * Math.pow(1 + growthRate / 100, year);
    const discounted = projected / Math.pow(1 + wacc / 100, year);
    sumDiscounted += discounted;
    lastDiscounted = discounted;
  }

  const terminalValue =
    lastDiscounted * (1 + terminalGrowth / 100) / (wacc / 100 - terminalGrowth / 100);
  const discountedTerminal = terminalValue / Math.pow(1 + wacc / 100, years);

  const enterpriseValue = sumDiscounted + discountedTerminal;
  return enterpriseValue / sharesOutstanding;
}

/* ────────────────────────────────────────────
   Format helpers
   ──────────────────────────────────────────── */

function formatCurrency(n) {
  if (n == null || isNaN(n)) return '--';
  if (n < 0) return `-$${Math.abs(n).toFixed(2)}`;
  return `$${n.toFixed(2)}`;
}

function formatPct(n) {
  if (n == null || isNaN(n)) return '--';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

/* ────────────────────────────────────────────
   Heatmap class helpers
   ──────────────────────────────────────────── */

function heatmapBgClass(fairValue, currentPrice) {
  if (fairValue == null || currentPrice == null) return 'bg-transparent';
  const upside = ((fairValue - currentPrice) / currentPrice) * 100;
  if (upside > 30) return 'bg-up/30';
  if (upside > 20) return 'bg-up/25';
  if (upside > 10) return 'bg-up/15';
  if (upside < -30) return 'bg-down/30';
  if (upside < -20) return 'bg-down/25';
  if (upside < -10) return 'bg-down/15';
  return 'bg-text-tertiary/10';
}

function heatmapTextClass(fairValue, currentPrice) {
  if (fairValue == null || currentPrice == null) return 'text-text-tertiary';
  const upside = ((fairValue - currentPrice) / currentPrice) * 100;
  if (upside > 10) return 'text-up';
  if (upside < -10) return 'text-down';
  return 'text-text-secondary';
}

/* ────────────────────────────────────────────
   Sensitivity table constants
   ──────────────────────────────────────────── */

const WACC_VALUES = [6, 8, 10, 12, 14];
const GROWTH_VALUES = [5, 10, 15, 20, 25];

/* ────────────────────────────────────────────
   Range slider + heatmap hover styling
   (pseudo-elements and :hover on nested
   selectors cannot be expressed in Tailwind)
   ──────────────────────────────────────────── */

const RANGE_SLIDER_CSS = `
  .dcf-slider-grid input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-accent);
    cursor: pointer;
    border: 2px solid var(--color-surface);
    box-shadow: 0 0 0 3px var(--color-accent-muted);
    transition: box-shadow 150ms ease;
  }

  .dcf-slider-grid input[type="range"]::-webkit-slider-thumb:hover {
    box-shadow: 0 0 0 5px var(--color-accent-muted);
  }

  .dcf-slider-grid input[type="range"]::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-accent);
    cursor: pointer;
    border: 2px solid var(--color-surface);
    box-shadow: 0 0 0 3px var(--color-accent-muted);
  }

  .dcf-slider-grid input[type="range"]::-moz-range-track {
    height: 6px;
    background: var(--color-elevated);
    border-radius: 9999px;
    border: none;
  }

  .dcf-heatmap-table tbody tr:hover td {
    filter: brightness(1.15);
  }
`;

/* ────────────────────────────────────────────
   ValuationTab
   ──────────────────────────────────────────── */

function ValuationTab({ ticker, company }) {
  const { data: dcfData, isLoading, error } = useDCFInputs(ticker);

  const [growthRate, setGrowthRate] = useState(10);
  const [wacc, setWacc] = useState(10);
  const [terminalGrowth, setTerminalGrowth] = useState(2.5);
  const [projectionYears, setProjectionYears] = useState(5);

  const fcf = dcfData?.free_cash_flow != null ? Number(dcfData.free_cash_flow) : null;
  const sharesOutstanding = dcfData?.shares_outstanding != null
    ? Number(dcfData.shares_outstanding)
    : null;
  const currentPrice = dcfData?.current_price != null
    ? Number(dcfData.current_price)
    : null;
  const sectorWarning = dcfData?.sector_warning || '';
  const negativeFcfWarning = dcfData?.negative_fcf_warning || false;
  const sector = dcfData?.sector || company?.sector || '';

  /* --- Computed fair value --- */
  const fairValue = useMemo(
    () => computeDCF(fcf, growthRate, wacc, terminalGrowth, projectionYears, sharesOutstanding),
    [fcf, growthRate, wacc, terminalGrowth, projectionYears, sharesOutstanding],
  );

  const upside = useMemo(() => {
    if (fairValue == null || currentPrice == null || currentPrice === 0) return null;
    return ((fairValue - currentPrice) / currentPrice) * 100;
  }, [fairValue, currentPrice]);

  const valuationLabel = useMemo(() => {
    if (upside == null) return null;
    if (upside > 10) return 'Undervalued';
    if (upside < -10) return 'Overvalued';
    return 'Fairly Valued';
  }, [upside]);

  /* --- Sensitivity heatmap --- */
  const heatmapData = useMemo(() => {
    if (fcf == null || sharesOutstanding == null) return null;
    return WACC_VALUES.map((w) =>
      GROWTH_VALUES.map((g) =>
        computeDCF(fcf, g, w, terminalGrowth, projectionYears, sharesOutstanding),
      ),
    );
  }, [fcf, terminalGrowth, projectionYears, sharesOutstanding]);

  /* --- WACC <= terminal growth warning --- */
  const waccWarning = wacc <= terminalGrowth;

  /* ---- Loading / Error states ---- */
  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <span className="font-body text-base text-text-secondary">Loading DCF inputs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-8">
        <div className="bg-surface border border-error rounded-lg p-8 text-center">
          <span className="font-body text-base text-error">
            Failed to load DCF data. Please try again later.
          </span>
        </div>
      </div>
    );
  }

  if (fcf == null) {
    return (
      <div className="flex flex-col gap-8">
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <span className="font-body text-base text-text-secondary">
            Insufficient data for DCF analysis. Free cash flow data is not available for {ticker}.
          </span>
        </div>
      </div>
    );
  }

  if (sharesOutstanding == null) {
    return (
      <div className="flex flex-col gap-8">
        <div className="bg-surface border border-error rounded-lg p-8 text-center">
          <span className="font-body text-base text-error">
            Shares outstanding data is unavailable for {ticker}. Cannot compute DCF.
          </span>
        </div>
      </div>
    );
  }

  /* --- Find closest heatmap cell to current inputs --- */
  const closestWaccIdx = WACC_VALUES.reduce(
    (best, v, i) => (Math.abs(v - wacc) < Math.abs(WACC_VALUES[best] - wacc) ? i : best),
    0,
  );
  const closestGrowthIdx = GROWTH_VALUES.reduce(
    (best, v, i) =>
      Math.abs(v - growthRate) < Math.abs(GROWTH_VALUES[best] - growthRate) ? i : best,
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <style>{RANGE_SLIDER_CSS}</style>

      {/* ============ A. Result Banner ============ */}
      <section className="bg-surface border border-border rounded-lg p-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-body text-sm font-medium text-text-secondary tracking-wide uppercase">Fair Value</span>
          <span className="font-data text-4xl font-bold text-text-primary leading-none">
            {waccWarning ? '--' : formatCurrency(fairValue)}
          </span>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2">
            <span className="font-body text-sm text-text-tertiary">Current Price</span>
            <span className="font-data text-lg font-medium text-text-primary">{formatCurrency(currentPrice)}</span>
          </div>

          {!waccWarning && upside != null && (
            <div className="flex items-center gap-2">
              <span className="font-body text-sm text-text-tertiary">Upside / Downside</span>
              <span
                className={`font-data text-sm font-semibold px-3 py-1 rounded-full ${
                  upside >= 0
                    ? 'bg-up/15 text-up'
                    : 'bg-down/15 text-down'
                }`}
              >
                {formatPct(upside)}
              </span>
            </div>
          )}

          {!waccWarning && valuationLabel && (
            <div className="flex items-center gap-2">
              <span
                className={`font-body text-xs font-semibold px-3 py-1 rounded-full tracking-wide uppercase ${
                  valuationLabel === 'Undervalued'
                    ? 'bg-up/15 text-up'
                    : valuationLabel === 'Overvalued'
                      ? 'bg-down/15 text-down'
                      : 'bg-text-tertiary/12 text-text-secondary'
                }`}
              >
                {valuationLabel}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ============ B. Warning Banners ============ */}
      {waccWarning && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] rounded-lg p-4 flex items-start gap-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#F59E0B]/20 font-data text-xs font-bold shrink-0 leading-none">!</span>
          <span className="font-body text-sm leading-normal">
            WACC must exceed the terminal growth rate. Adjust your inputs to compute a fair value.
          </span>
        </div>
      )}

      {sectorWarning && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] rounded-lg p-4 flex items-start gap-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#F59E0B]/20 font-data text-xs font-bold shrink-0 leading-none">!</span>
          <span className="font-body text-sm leading-normal">{sectorWarning}</span>
        </div>
      )}

      {negativeFcfWarning && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] rounded-lg p-4 flex items-start gap-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#F59E0B]/20 font-data text-xs font-bold shrink-0 leading-none">!</span>
          <span className="font-body text-sm leading-normal">
            Negative free cash flow — DCF results may be unreliable.
          </span>
        </div>
      )}

      {/* ============ C. Input Sliders ============ */}
      <section>
        <h3 className="font-display text-lg font-bold text-text-primary mb-4">Assumptions</h3>
        <div className="dcf-slider-grid grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
          <SliderInput
            label="Growth Rate"
            value={growthRate}
            onChange={setGrowthRate}
            min={0}
            max={30}
            step={0.5}
            suffix="%"
          />
          <SliderInput
            label="WACC (Discount Rate)"
            value={wacc}
            onChange={setWacc}
            min={6}
            max={15}
            step={0.5}
            suffix="%"
          />
          <SliderInput
            label="Terminal Growth Rate"
            value={terminalGrowth}
            onChange={setTerminalGrowth}
            min={1}
            max={4}
            step={0.25}
            suffix="%"
          />
          <SliderInput
            label="Projection Years"
            value={projectionYears}
            onChange={setProjectionYears}
            min={3}
            max={10}
            step={1}
            suffix=""
          />
        </div>
      </section>

      {/* ============ D. Sensitivity Heatmap ============ */}
      {heatmapData && (
        <section className="mt-6">
          <h3 className="font-display text-lg font-bold text-text-primary mb-4">Sensitivity Analysis</h3>
          <p className="font-body text-sm text-text-tertiary -mt-3 mb-4">
            Fair value per share across WACC and growth rate combinations
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="dcf-heatmap-table w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-xs font-data text-text-secondary p-2 bg-elevated text-left border-b border-border border-r border-border whitespace-nowrap">WACC \ Growth</th>
                  {GROWTH_VALUES.map((g) => (
                    <th key={g} className="text-xs font-data text-text-secondary p-2 bg-elevated text-center border-b border-border whitespace-nowrap font-semibold">
                      {g}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WACC_VALUES.map((w, ri) => (
                  <tr key={w}>
                    <td className="text-xs font-data text-text-secondary p-2 bg-elevated text-left border-r border-border whitespace-nowrap font-semibold">{w}%</td>
                    {GROWTH_VALUES.map((g, ci) => {
                      const val = heatmapData[ri][ci];
                      const isHighlighted =
                        ri === closestWaccIdx && ci === closestGrowthIdx;
                      return (
                        <td
                          key={g}
                          className={`text-xs font-data p-2 text-center border border-border font-medium whitespace-nowrap transition-colors duration-150 ${heatmapBgClass(val, currentPrice)} ${heatmapTextClass(val, currentPrice)} ${
                            isHighlighted ? 'ring-2 ring-accent font-bold' : ''
                          }`}
                        >
                          {val != null ? formatCurrency(val) : '--'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   SliderInput component
   ──────────────────────────────────────────── */

function SliderInput({ label, value, onChange, min, max, step, suffix }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="text-accent font-data font-semibold">
          {step < 1 ? value.toFixed(step < 0.5 ? 2 : 1) : value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-2 h-2 rounded-lg appearance-none cursor-pointer"
        style={{ accentColor: '#14B8A6' }}
      />
      <div className="flex justify-between text-xs text-text-tertiary font-data mt-1">
        <span>{min}{suffix}</span>
        <span>{max}{suffix}</span>
      </div>
    </div>
  );
}

export default ValuationTab;
