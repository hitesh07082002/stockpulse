import React, { useEffect } from 'react';
import {
  CHIP_BUTTON_CLASS,
  INPUT_CLASS,
  MARKET_CAP_PRESETS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SECTORS,
} from './screener-config';

function FilterGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <span className="font-body text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">
        {label}
      </span>
      {children}
    </div>
  );
}

function MinMaxInputs({ minValue, maxValue, onMinChange, onMaxChange, placeholder }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      <input
        type="number"
        placeholder={placeholder?.min ?? 'Min'}
        value={minValue}
        onChange={(event) => onMinChange(event.target.value)}
        className={INPUT_CLASS}
      />
      <span className="shrink-0 text-xs text-text-tertiary">to</span>
      <input
        type="number"
        placeholder={placeholder?.max ?? 'Max'}
        value={maxValue}
        onChange={(event) => onMaxChange(event.target.value)}
        className={INPUT_CLASS}
      />
    </div>
  );
}

export function ScreenerFiltersPanel({
  activeFilterCount,
  filters,
  onApply,
  onClear,
  onMarketCapPreset,
  onToggleMoreFilters,
  onUpdateFilter,
  showHeading,
  showMoreFilters,
}) {
  return (
    <div className="flex flex-col gap-4">
      {showHeading ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-semibold text-text-primary">
              Stock Screener
            </h1>
            <p className="font-body text-sm text-text-secondary">
              Filter the S&amp;P 500 by valuation, growth, and balance-sheet quality.
            </p>
          </div>
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-elevated px-2.5 py-1 font-data text-[11px] text-text-secondary">
              {activeFilterCount} active
            </span>
          ) : null}
        </div>
      ) : null}

      <FilterGroup label="Sector">
        <select
          value={filters.sector}
          onChange={(event) => onUpdateFilter('sector', event.target.value)}
          className={`${INPUT_CLASS} appearance-none`}
        >
          <option value="">All sectors</option>
          {SECTORS.map((sector) => (
            <option key={sector} value={sector}>{sector}</option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup label="Market Cap">
        <div className="mb-1 flex flex-wrap gap-2">
          {MARKET_CAP_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onMarketCapPreset(preset)}
              className={CHIP_BUTTON_CLASS}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <MinMaxInputs
          minValue={filters.market_cap_min}
          maxValue={filters.market_cap_max}
          onMinChange={(value) => onUpdateFilter('market_cap_min', value)}
          onMaxChange={(value) => onUpdateFilter('market_cap_max', value)}
          placeholder={{ min: 'Min ($)', max: 'Max ($)' }}
        />
      </FilterGroup>

      <FilterGroup label="P/E Ratio">
        <MinMaxInputs
          minValue={filters.pe_min}
          maxValue={filters.pe_max}
          onMinChange={(value) => onUpdateFilter('pe_min', value)}
          onMaxChange={(value) => onUpdateFilter('pe_max', value)}
        />
      </FilterGroup>

      <FilterGroup label="Cash Flow">
        <label className="flex items-center gap-3 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={filters.positive_fcf}
            onChange={(event) => onUpdateFilter('positive_fcf', event.target.checked)}
            className="h-4 w-4 rounded border-border bg-elevated text-accent focus:ring-accent"
          />
          <span className="font-body text-sm">Positive free cash flow only</span>
        </label>
      </FilterGroup>

      <button
        type="button"
        onClick={onToggleMoreFilters}
        className="min-h-11 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-left font-body text-sm text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
      >
        {showMoreFilters ? 'Hide more filters' : 'More filters'}
      </button>

      {showMoreFilters ? (
        <div className="flex flex-col gap-4">
          <FilterGroup label="Industry">
            <input
              type="text"
              value={filters.industry}
              onChange={(event) => onUpdateFilter('industry', event.target.value)}
              placeholder="Semiconductors, Software..."
              className={INPUT_CLASS}
            />
          </FilterGroup>

          <FilterGroup label="Revenue Growth (%)">
            <MinMaxInputs
              minValue={filters.revenue_growth_min}
              maxValue={filters.revenue_growth_max}
              onMinChange={(value) => onUpdateFilter('revenue_growth_min', value)}
              onMaxChange={(value) => onUpdateFilter('revenue_growth_max', value)}
            />
          </FilterGroup>

          <FilterGroup label="Gross Margin (%)">
            <MinMaxInputs
              minValue={filters.gross_margin_min}
              maxValue={filters.gross_margin_max}
              onMinChange={(value) => onUpdateFilter('gross_margin_min', value)}
              onMaxChange={(value) => onUpdateFilter('gross_margin_max', value)}
            />
          </FilterGroup>

          <FilterGroup label="Operating Margin (%)">
            <MinMaxInputs
              minValue={filters.operating_margin_min}
              maxValue={filters.operating_margin_max}
              onMinChange={(value) => onUpdateFilter('operating_margin_min', value)}
              onMaxChange={(value) => onUpdateFilter('operating_margin_max', value)}
            />
          </FilterGroup>

          <FilterGroup label="Debt / Equity">
            <MinMaxInputs
              minValue={filters.debt_to_equity_min}
              maxValue={filters.debt_to_equity_max}
              onMinChange={(value) => onUpdateFilter('debt_to_equity_min', value)}
              onMaxChange={(value) => onUpdateFilter('debt_to_equity_max', value)}
            />
          </FilterGroup>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onClear}
          className={`${SECONDARY_BUTTON_CLASS} flex-1`}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onApply}
          className={`${PRIMARY_BUTTON_CLASS} flex-1`}
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}

export function ScreenerMobileFilterSheet({
  isOpen,
  onClose,
  ...panelProps
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(6,12,18,0.65)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-screener-filters-title"
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[28px] border border-border bg-base shadow-[0_-24px_80px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div className="flex flex-col gap-1">
            <span className="font-data text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              Mobile Filters
            </span>
            <h2 id="mobile-screener-filters-title" className="font-display text-xl font-semibold text-text-primary">
              Refine results
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={SECONDARY_BUTTON_CLASS}
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(88vh-88px)] overflow-y-auto p-4">
          <ScreenerFiltersPanel
            {...panelProps}
            showHeading={false}
          />
        </div>
      </div>
    </div>
  );
}
