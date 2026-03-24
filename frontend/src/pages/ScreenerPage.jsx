import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScreener } from '../hooks/useStockData';
import { useMinWidth } from '../hooks/useMinWidth';

const SECTORS = [
  'Communication Services',
  'Consumer Discretionary',
  'Consumer Staples',
  'Energy',
  'Financials',
  'Health Care',
  'Industrials',
  'Information Technology',
  'Materials',
  'Real Estate',
  'Utilities',
];

const MARKET_CAP_PRESETS = [
  { label: 'Large >$10B', min: 10e9, max: '' },
  { label: 'Mid $2-10B', min: 2e9, max: 10e9 },
  { label: 'Small <$2B', min: '', max: 2e9 },
];

const COLUMNS = [
  { key: 'ticker', label: 'Ticker', sortable: true },
  { key: 'name', label: 'Company', sortable: true },
  { key: 'sector', label: 'Sector', sortable: true },
  { key: 'current_price', label: 'Price', sortable: true, numeric: true },
  { key: 'market_cap', label: 'Market Cap', sortable: true, numeric: true },
  { key: 'pe_ratio', label: 'P/E', sortable: true, numeric: true },
  { key: 'revenue_growth_yoy', label: 'Rev YoY', sortable: true, numeric: true, percent: true },
  { key: 'gross_margin', label: 'Gross Margin', sortable: true, numeric: true, percent: true },
  { key: 'operating_margin', label: 'Op Margin', sortable: true, numeric: true, percent: true },
  { key: 'debt_to_equity', label: 'Debt / Equity', sortable: true, numeric: true },
];

const INITIAL_FILTERS = {
  sector: '',
  industry: '',
  market_cap_min: '',
  market_cap_max: '',
  pe_min: '',
  pe_max: '',
  positive_fcf: false,
  revenue_growth_min: '',
  revenue_growth_max: '',
  gross_margin_min: '',
  gross_margin_max: '',
  operating_margin_min: '',
  operating_margin_max: '',
  debt_to_equity_min: '',
  debt_to_equity_max: '',
};

const PERCENT_FILTER_KEYS = new Set([
  'revenue_growth_min',
  'revenue_growth_max',
  'gross_margin_min',
  'gross_margin_max',
  'operating_margin_min',
  'operating_margin_max',
]);

const INPUT_CLASS = 'min-h-11 w-full rounded-md border border-border bg-elevated px-3 py-2.5 font-body text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none';
const SECONDARY_BUTTON_CLASS = 'min-h-11 rounded-md border border-border bg-transparent px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30';
const PRIMARY_BUTTON_CLASS = 'min-h-11 rounded-md border-none bg-accent px-4 py-2.5 font-body text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover';
const CHIP_BUTTON_CLASS = 'rounded-full border border-border bg-transparent px-3 py-1.5 font-body text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent';
const SORTABLE_COLUMNS = COLUMNS.filter((column) => column.sortable);

function formatMarketCap(value) {
  if (value == null) return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
  return `$${num.toLocaleString()}`;
}

function formatNumber(value, decimals = 2) {
  if (value == null) return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return num.toFixed(decimals);
}

function formatPercent(value) {
  if (value == null) return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return `${(num * 100).toFixed(2)}%`;
}

function formatPrice(value) {
  if (value == null) return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return `$${num.toFixed(2)}`;
}

function countActiveFilters(filters) {
  return Object.values(filters).filter((value) => value !== '' && value != null && value !== false).length;
}

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

function SkeletonRow() {
  return (
    <tr>
      {COLUMNS.map((column) => (
        <td key={column.key} className="px-3 py-3">
          <div className="skeleton h-4 rounded" />
        </td>
      ))}
    </tr>
  );
}

function ScreenerCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-5 w-40 rounded" />
        </div>
        <div className="skeleton h-4 w-12 rounded" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-1">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-4 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SortIcon({ direction }) {
  if (!direction) {
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-1 inline-block opacity-30"
      >
        <path d="M7 15l5 5 5-5" />
        <path d="M7 9l5-5 5 5" />
      </svg>
    );
  }

  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ml-1 inline-block"
    >
      {direction === 'asc' ? <path d="M7 14l5-5 5 5" /> : <path d="M7 10l5 5 5-5" />}
    </svg>
  );
}

function buildFilterPayload(filters) {
  const payload = {};

  Object.entries(filters).forEach(([key, rawValue]) => {
    if (rawValue === '' || rawValue == null) return;

    if (key === 'positive_fcf') {
      if (rawValue) payload[key] = 'true';
      return;
    }

    if (PERCENT_FILTER_KEYS.has(key)) {
      payload[key] = String(Number(rawValue) / 100);
      return;
    }

    payload[key] = rawValue;
  });

  return payload;
}

function renderCell(row, column) {
  switch (column.key) {
    case 'ticker':
      return <span className="font-data text-xs font-medium text-accent">{row.ticker}</span>;
    case 'name':
      return <span className="block max-w-[200px] truncate font-body text-xs text-text-primary">{row.name ?? '--'}</span>;
    case 'sector':
      return <span className="font-body text-xs text-text-secondary">{row.sector ?? '--'}</span>;
    case 'current_price':
      return <span className="font-data text-xs text-text-primary">{formatPrice(row.current_price)}</span>;
    case 'market_cap':
      return <span className="font-data text-xs text-text-primary">{formatMarketCap(row.market_cap)}</span>;
    case 'pe_ratio':
    case 'debt_to_equity':
      return <span className="font-data text-xs text-text-primary">{formatNumber(row[column.key])}</span>;
    case 'revenue_growth_yoy':
    case 'gross_margin':
    case 'operating_margin':
      return <span className="font-data text-xs text-text-primary">{formatPercent(row[column.key])}</span>;
    default:
      return '--';
  }
}

function ScreenerResultCard({ row, onSelect }) {
  const metrics = [
    { label: 'Price', value: formatPrice(row.current_price) },
    { label: 'Market Cap', value: formatMarketCap(row.market_cap) },
    { label: 'P/E', value: formatNumber(row.pe_ratio) },
    { label: 'Rev YoY', value: formatPercent(row.revenue_growth_yoy) },
    { label: 'Gross Margin', value: formatPercent(row.gross_margin) },
    { label: 'Debt / Equity', value: formatNumber(row.debt_to_equity) },
  ];

  return (
    <button
      type="button"
      onClick={() => onSelect(row.ticker)}
      className="w-full rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent hover:bg-elevated"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-data text-sm font-bold text-accent">{row.ticker}</span>
            {row.sector ? (
              <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] text-text-secondary">
                {row.sector}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 truncate font-body text-base font-semibold text-text-primary">
            {row.name ?? '--'}
          </h2>
        </div>
        <span className="font-data text-xs text-text-tertiary">Open</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex flex-col gap-1">
            <dt className="font-body text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
              {metric.label}
            </dt>
            <dd className="font-data text-sm text-text-primary">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </button>
  );
}

function ScreenerFiltersPanel({
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
              placeholder="Semiconductors, Software…"
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

export default function ScreenerPage() {
  const navigate = useNavigate();
  const isDesktop = useMinWidth(1024);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [sortKey, setSortKey] = useState('market_cap');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, isFetching } = useScreener(appliedFilters, sortKey, sortDir, page);

  const results = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const pageSize = results.length > 0 ? results.length : 25;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const activeFilterCount = countActiveFilters(appliedFilters);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleApply = () => {
    setAppliedFilters(buildFilterPayload(filters));
    setPage(1);

    if (!isDesktop) {
      setShowMobileFilters(false);
    }
  };

  const handleClear = () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters({});
    setSortKey('market_cap');
    setSortDir('desc');
    setPage(1);
    setShowMoreFilters(false);
    setShowMobileFilters(false);
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(['ticker', 'name', 'sector'].includes(key) ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const handleSortChange = (nextSortKey) => {
    setSortKey(nextSortKey);
    setSortDir(['ticker', 'name', 'sector'].includes(nextSortKey) ? 'asc' : 'desc');
    setPage(1);
  };

  const handleMarketCapPreset = (preset) => {
    setFilters((current) => ({
      ...current,
      market_cap_min: preset.min,
      market_cap_max: preset.max,
    }));
  };

  const resultSummary = useMemo(() => {
    if (isLoading) return 'Loading…';
    return `${totalCount} result${totalCount === 1 ? '' : 's'}`;
  }, [isLoading, totalCount]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {isDesktop ? (
        <aside className="w-full shrink-0 lg:w-80">
          <ScreenerFiltersPanel
            activeFilterCount={activeFilterCount}
            filters={filters}
            onApply={handleApply}
            onClear={handleClear}
            onMarketCapPreset={handleMarketCapPreset}
            onToggleMoreFilters={() => setShowMoreFilters((current) => !current)}
            onUpdateFilter={updateFilter}
            showHeading
            showMoreFilters={showMoreFilters}
          />
        </aside>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="font-display text-2xl font-semibold text-text-primary">
                  Stock Screener
                </h1>
                <p className="font-body text-sm text-text-secondary">
                  Filter the S&amp;P 500 by valuation, growth, and balance-sheet quality.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-elevated px-2.5 py-1 font-data text-[11px] text-text-secondary">
                  {isFetching && !isLoading ? 'Refreshing…' : resultSummary}
                </span>
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-elevated px-2.5 py-1 font-data text-[11px] text-text-secondary">
                    {activeFilterCount} active
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowMobileFilters((current) => !current)}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {showMobileFilters ? 'Hide filters' : 'Filters'}
                </button>
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    className={SECONDARY_BUTTON_CLASS}
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {showMobileFilters ? (
            <div className="rounded-xl border border-border bg-base p-1">
              <ScreenerFiltersPanel
                activeFilterCount={activeFilterCount}
                filters={filters}
                onApply={handleApply}
                onClear={handleClear}
                onMarketCapPreset={handleMarketCapPreset}
                onToggleMoreFilters={() => setShowMoreFilters((current) => !current)}
                onUpdateFilter={updateFilter}
                showHeading={false}
                showMoreFilters={showMoreFilters}
              />
            </div>
          ) : null}
        </div>
      )}

      <section className="min-w-0 flex-1">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-body text-sm text-text-secondary">
              Focused filters on canonical metric snapshots.
            </p>
            {!isDesktop ? (
              <p className="font-data text-xs text-text-tertiary">
                Tap a company card to jump into the full detail view.
              </p>
            ) : null}
          </div>

          {isDesktop ? (
            <span className="font-data text-xs text-text-tertiary">
              {isFetching && !isLoading ? 'Refreshing…' : resultSummary}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <label htmlFor="mobile-sort" className="sr-only">
                Sort results
              </label>
              <select
                id="mobile-sort"
                value={sortKey}
                onChange={(event) => handleSortChange(event.target.value)}
                className={`${INPUT_CLASS} min-w-[160px]`}
              >
                {SORTABLE_COLUMNS.map((column) => (
                  <option key={column.key} value={column.key}>
                    Sort: {column.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleSort(sortKey)}
                className={SECONDARY_BUTTON_CLASS}
              >
                {sortDir === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {isError ? (
            <div className="px-6 py-16 text-center">
              <p className="font-body text-base text-error">Screener unavailable. Try again.</p>
              {error?.message ? (
                <p className="mt-2 font-body text-sm text-text-tertiary">{error.message}</p>
              ) : null}
            </div>
          ) : isDesktop ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {COLUMNS.map((column) => (
                        <th
                          key={column.key}
                          onClick={column.sortable ? () => handleSort(column.key) : undefined}
                          className={`px-3 py-3 text-left font-body text-xs font-medium text-text-secondary whitespace-nowrap ${
                            column.sortable
                              ? 'cursor-pointer select-none transition-colors hover:text-text-primary'
                              : ''
                          } ${column.numeric ? 'text-right' : ''}`}
                        >
                          {column.label}
                          {column.sortable ? (
                            <SortIcon direction={sortKey === column.key ? sortDir : null} />
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {isLoading ? Array.from({ length: 8 }).map((_, index) => <SkeletonRow key={index} />) : null}

                    {!isLoading && results.length === 0 ? (
                      <tr>
                        <td colSpan={COLUMNS.length} className="px-6 py-16 text-center">
                          <p className="font-body text-sm text-text-secondary">
                            No companies match your filters. Try broadening your criteria.
                          </p>
                          <button
                            type="button"
                            onClick={handleClear}
                            className="mt-3 border-none bg-transparent font-body text-xs text-accent transition-colors hover:text-accent-hover"
                          >
                            Reset filters
                          </button>
                        </td>
                      </tr>
                    ) : null}

                    {!isLoading ? results.map((row) => (
                      <tr
                        key={row.ticker}
                        onClick={() => navigate(`/stock/${row.ticker}`)}
                        className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-elevated"
                      >
                        {COLUMNS.map((column) => (
                          <td key={column.key} className={`px-3 py-3 ${column.numeric ? 'text-right' : ''}`}>
                            {renderCell(row, column)}
                          </td>
                        ))}
                      </tr>
                    )) : null}
                  </tbody>
                </table>
              </div>

              {!isLoading && totalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="font-body text-xs text-text-tertiary">Page {page} of {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      className="rounded-md border border-border bg-transparent px-3 py-1.5 font-body text-xs text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                      className="rounded-md border border-border bg-transparent px-3 py-1.5 font-body text-xs text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 p-4">
                {isLoading ? Array.from({ length: 6 }).map((_, index) => <ScreenerCardSkeleton key={index} />) : null}

                {!isLoading && results.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-base px-5 py-10 text-center">
                    <p className="font-body text-sm text-text-secondary">
                      No companies match your filters. Try broadening your criteria.
                    </p>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="mt-4 border-none bg-transparent font-body text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    >
                      Reset filters
                    </button>
                  </div>
                ) : null}

                {!isLoading ? results.map((row) => (
                  <ScreenerResultCard
                    key={row.ticker}
                    row={row}
                    onSelect={(nextTicker) => navigate(`/stock/${nextTicker}`)}
                  />
                )) : null}
              </div>

              {!isLoading && totalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="font-body text-xs text-text-tertiary">Page {page} of {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      className={SECONDARY_BUTTON_CLASS}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                      className={SECONDARY_BUTTON_CLASS}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
