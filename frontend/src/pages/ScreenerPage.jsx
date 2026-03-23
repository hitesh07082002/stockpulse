import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScreener } from '../hooks/useStockData';

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

function FilterGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <span className="font-body text-xs font-medium uppercase tracking-wider text-text-secondary">
        {label}
      </span>
      {children}
    </div>
  );
}

function MinMaxInputs({ minValue, maxValue, onMinChange, onMaxChange, placeholder }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        placeholder={placeholder?.min ?? 'Min'}
        value={minValue}
        onChange={(event) => onMinChange(event.target.value)}
        className="w-full rounded-sm border border-border bg-elevated px-2 py-1.5 font-data text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
      />
      <span className="shrink-0 text-xs text-text-tertiary">to</span>
      <input
        type="number"
        placeholder={placeholder?.max ?? 'Max'}
        value={maxValue}
        onChange={(event) => onMaxChange(event.target.value)}
        className="w-full rounded-sm border border-border bg-elevated px-2 py-1.5 font-data text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
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

export default function ScreenerPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [sortKey, setSortKey] = useState('market_cap');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, isFetching } = useScreener(appliedFilters, sortKey, sortDir, page);

  const results = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const pageSize = results.length > 0 ? results.length : 25;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleApply = () => {
    setAppliedFilters(buildFilterPayload(filters));
    setPage(1);
  };

  const handleClear = () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters({});
    setSortKey('market_cap');
    setSortDir('desc');
    setPage(1);
    setShowMoreFilters(false);
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
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-80">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-text-primary">Stock Screener</h1>
          <button
            type="button"
            onClick={handleClear}
            className="border-none bg-transparent font-body text-xs text-text-tertiary transition-colors hover:text-accent"
          >
            Reset
          </button>
        </div>

        <FilterGroup label="Sector">
          <select
            value={filters.sector}
            onChange={(event) => updateFilter('sector', event.target.value)}
            className="w-full appearance-none rounded-sm border border-border bg-elevated px-2 py-1.5 font-body text-xs text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="">All sectors</option>
            {SECTORS.map((sector) => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label="Market Cap">
          <div className="mb-1 flex flex-wrap gap-1.5">
            {MARKET_CAP_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleMarketCapPreset(preset)}
                className="rounded-full border border-border bg-transparent px-2 py-0.5 font-body text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <MinMaxInputs
            minValue={filters.market_cap_min}
            maxValue={filters.market_cap_max}
            onMinChange={(value) => updateFilter('market_cap_min', value)}
            onMaxChange={(value) => updateFilter('market_cap_max', value)}
            placeholder={{ min: 'Min ($)', max: 'Max ($)' }}
          />
        </FilterGroup>

        <FilterGroup label="P/E Ratio">
          <MinMaxInputs
            minValue={filters.pe_min}
            maxValue={filters.pe_max}
            onMinChange={(value) => updateFilter('pe_min', value)}
            onMaxChange={(value) => updateFilter('pe_max', value)}
          />
        </FilterGroup>

        <FilterGroup label="Cash Flow">
          <label className="flex items-center gap-3 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={filters.positive_fcf}
              onChange={(event) => updateFilter('positive_fcf', event.target.checked)}
              className="h-4 w-4 rounded border-border bg-elevated text-accent focus:ring-accent"
            />
            <span className="font-body text-sm">Positive free cash flow only</span>
          </label>
        </FilterGroup>

        <button
          type="button"
          onClick={() => setShowMoreFilters((current) => !current)}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-left font-body text-sm text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
        >
          {showMoreFilters ? 'Hide more filters' : 'More filters'}
        </button>

        {showMoreFilters ? (
          <div className="flex flex-col gap-4">
            <FilterGroup label="Industry">
              <input
                type="text"
                value={filters.industry}
                onChange={(event) => updateFilter('industry', event.target.value)}
                placeholder="Semiconductors, Software…"
                className="w-full rounded-sm border border-border bg-elevated px-2 py-1.5 font-body text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </FilterGroup>

            <FilterGroup label="Revenue Growth (%)">
              <MinMaxInputs
                minValue={filters.revenue_growth_min}
                maxValue={filters.revenue_growth_max}
                onMinChange={(value) => updateFilter('revenue_growth_min', value)}
                onMaxChange={(value) => updateFilter('revenue_growth_max', value)}
              />
            </FilterGroup>

            <FilterGroup label="Gross Margin (%)">
              <MinMaxInputs
                minValue={filters.gross_margin_min}
                maxValue={filters.gross_margin_max}
                onMinChange={(value) => updateFilter('gross_margin_min', value)}
                onMaxChange={(value) => updateFilter('gross_margin_max', value)}
              />
            </FilterGroup>

            <FilterGroup label="Operating Margin (%)">
              <MinMaxInputs
                minValue={filters.operating_margin_min}
                maxValue={filters.operating_margin_max}
                onMinChange={(value) => updateFilter('operating_margin_min', value)}
                onMaxChange={(value) => updateFilter('operating_margin_max', value)}
              />
            </FilterGroup>

            <FilterGroup label="Debt / Equity">
              <MinMaxInputs
                minValue={filters.debt_to_equity_min}
                maxValue={filters.debt_to_equity_max}
                onMinChange={(value) => updateFilter('debt_to_equity_min', value)}
                onMaxChange={(value) => updateFilter('debt_to_equity_max', value)}
              />
            </FilterGroup>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleApply}
          className="w-full rounded-md border-none bg-accent py-2.5 font-body text-sm font-medium text-text-inverse transition-colors hover:bg-accent-hover"
        >
          Apply Filters
        </button>
      </aside>

      <section className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-body text-sm text-text-secondary">Focused V1 filters on canonical metric snapshots.</p>
          </div>
          <span className="font-data text-xs text-text-tertiary">
            {isFetching && !isLoading ? 'Refreshing…' : resultSummary}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {isError ? (
            <div className="px-6 py-16 text-center">
              <p className="font-body text-base text-error">Screener unavailable. Try again.</p>
              {error?.message ? (
                <p className="mt-2 font-body text-sm text-text-tertiary">{error.message}</p>
              ) : null}
            </div>
          ) : (
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
          )}
        </div>
      </section>
    </div>
  );
}
