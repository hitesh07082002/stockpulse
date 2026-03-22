import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScreener } from '../hooks/useStockData';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Communication Services',
  'Industrials',
  'Consumer Defensive',
  'Energy',
  'Utilities',
  'Real Estate',
  'Basic Materials',
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
  { key: 'price', label: 'Price', sortable: true, numeric: true },
  { key: 'market_cap', label: 'Market Cap', sortable: true, numeric: true },
  { key: 'pe_ratio', label: 'P/E', sortable: true, numeric: true },
  { key: 'dividend_yield', label: 'Dividend %', sortable: true, numeric: true },
  { key: 'profit_margin', label: 'Margin %', sortable: true, numeric: true },
  { key: 'roe', label: 'ROE', sortable: true, numeric: true },
];

const PAGE_SIZE = 20;

const INITIAL_FILTERS = {
  sector: '',
  pe_min: '',
  pe_max: '',
  market_cap_min: '',
  market_cap_max: '',
  dividend_yield_min: '',
  dividend_yield_max: '',
  profit_margin_min: '',
  profit_margin_max: '',
  roe_min: '',
  roe_max: '',
  revenue_growth_min: '',
  revenue_growth_max: '',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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
  return `${num.toFixed(2)}%`;
}

function formatPrice(value) {
  if (value == null) return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return `$${num.toFixed(2)}`;
}

/* ------------------------------------------------------------------ */
/*  FilterGroup Component                                              */
/* ------------------------------------------------------------------ */

function FilterGroup({ label, children }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
      <span className="font-body text-xs font-medium text-text-secondary uppercase tracking-wider">
        {label}
      </span>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MinMaxInputs Component                                             */
/* ------------------------------------------------------------------ */

function MinMaxInputs({ minValue, maxValue, onMinChange, onMaxChange, placeholder }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        placeholder={placeholder?.min ?? 'Min'}
        value={minValue}
        onChange={(e) => onMinChange(e.target.value)}
        className="w-full bg-elevated border border-border rounded-sm px-2 py-1.5 font-data text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-colors"
      />
      <span className="text-text-tertiary text-xs shrink-0">to</span>
      <input
        type="number"
        placeholder={placeholder?.max ?? 'Max'}
        value={maxValue}
        onChange={(e) => onMaxChange(e.target.value)}
        className="w-full bg-elevated border border-border rounded-sm px-2 py-1.5 font-data text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-colors"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonRow Component                                              */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <tr>
      {COLUMNS.map((col) => (
        <td key={col.key} className="px-3 py-3">
          <div className="skeleton h-4 rounded" />
        </td>
      ))}
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  SortIcon Component                                                 */
/* ------------------------------------------------------------------ */

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
        className="inline-block ml-1 opacity-30"
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
      className="inline-block ml-1"
    >
      {direction === 'asc' ? (
        <path d="M7 14l5-5 5 5" />
      ) : (
        <path d="M7 10l5 5 5-5" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  ScreenerPage                                                       */
/* ------------------------------------------------------------------ */

export default function ScreenerPage() {
  const navigate = useNavigate();

  /* ---- Filter state ---- */
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState({});

  /* ---- Sort state ---- */
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(null); // 'asc' | 'desc'

  /* ---- Pagination ---- */
  const [page, setPage] = useState(1);

  /* ---- Data ---- */
  const { data, isLoading } = useScreener(appliedFilters);
  const results = data?.results ?? data ?? [];

  /* ---- Client-side sort ---- */
  const sortedResults = useMemo(() => {
    if (!sortKey || !sortDir) return results;
    const col = COLUMNS.find((c) => c.key === sortKey);
    return [...results].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (col?.numeric) {
        aVal = aVal != null ? Number(aVal) : -Infinity;
        bVal = bVal != null ? Number(bVal) : -Infinity;
      } else {
        aVal = String(aVal ?? '').toLowerCase();
        bVal = String(bVal ?? '').toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [results, sortKey, sortDir]);

  /* ---- Paginated results ---- */
  const totalPages = Math.max(1, Math.ceil(sortedResults.length / PAGE_SIZE));
  const paginatedResults = sortedResults.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  /* ---- Handlers ---- */
  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    // Build params object, omitting empty strings
    const params = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== '' && value != null) {
        params[key] = value;
      }
    }
    setAppliedFilters(params);
    setPage(1);
  };

  const handleClear = () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters({});
    setPage(1);
    setSortKey(null);
    setSortDir(null);
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else if (sortDir === 'desc') {
        setSortKey(null);
        setSortDir(null);
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleMarketCapPreset = (preset) => {
    setFilters((prev) => ({
      ...prev,
      market_cap_min: preset.min,
      market_cap_max: preset.max,
    }));
  };

  const handleRowClick = (ticker) => {
    navigate(`/stock/${ticker}`);
  };

  /* ---- Cell renderer ---- */
  const renderCell = (row, col) => {
    switch (col.key) {
      case 'ticker':
        return (
          <span className="font-data text-xs font-medium text-accent">
            {row.ticker}
          </span>
        );
      case 'name':
        return (
          <span className="font-body text-xs text-text-primary truncate max-w-[200px] block">
            {row.name ?? '--'}
          </span>
        );
      case 'sector':
        return (
          <span className="font-body text-xs text-text-secondary">
            {row.sector ?? '--'}
          </span>
        );
      case 'price':
        return (
          <span className="font-data text-xs text-text-primary">
            {formatPrice(row.price)}
          </span>
        );
      case 'market_cap':
        return (
          <span className="font-data text-xs text-text-primary">
            {formatMarketCap(row.market_cap)}
          </span>
        );
      case 'pe_ratio':
        return (
          <span className="font-data text-xs text-text-primary">
            {formatNumber(row.pe_ratio)}
          </span>
        );
      case 'dividend_yield':
        return (
          <span className="font-data text-xs text-text-primary">
            {formatPercent(row.dividend_yield)}
          </span>
        );
      case 'profit_margin':
        return (
          <span className="font-data text-xs text-text-primary">
            {formatPercent(row.profit_margin)}
          </span>
        );
      case 'roe':
        return (
          <span className="font-data text-xs text-text-primary">
            {formatPercent(row.roe)}
          </span>
        );
      default:
        return '--';
    }
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ============================================================
          Sidebar — Filters
         ============================================================ */}
      <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-text-primary">
            Filters
          </h2>
          <button
            onClick={handleClear}
            className="font-body text-xs text-text-tertiary hover:text-accent transition-colors cursor-pointer bg-transparent border-none"
          >
            Clear All
          </button>
        </div>

        {/* Sector */}
        <FilterGroup label="Sector">
          <select
            value={filters.sector}
            onChange={(e) => updateFilter('sector', e.target.value)}
            className="w-full bg-elevated border border-border rounded-sm px-2 py-1.5 font-body text-xs text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer appearance-none"
          >
            <option value="">All Sectors</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterGroup>

        {/* P/E Ratio */}
        <FilterGroup label="P/E Ratio">
          <MinMaxInputs
            minValue={filters.pe_min}
            maxValue={filters.pe_max}
            onMinChange={(v) => updateFilter('pe_min', v)}
            onMaxChange={(v) => updateFilter('pe_max', v)}
          />
        </FilterGroup>

        {/* Market Cap */}
        <FilterGroup label="Market Cap">
          <div className="flex flex-wrap gap-1.5 mb-1">
            {MARKET_CAP_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleMarketCapPreset(preset)}
                className="font-body text-xs px-2 py-0.5 rounded-full border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors cursor-pointer bg-transparent"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <MinMaxInputs
            minValue={filters.market_cap_min}
            maxValue={filters.market_cap_max}
            onMinChange={(v) => updateFilter('market_cap_min', v)}
            onMaxChange={(v) => updateFilter('market_cap_max', v)}
            placeholder={{ min: 'Min ($)', max: 'Max ($)' }}
          />
        </FilterGroup>

        {/* Dividend Yield */}
        <FilterGroup label="Dividend Yield (%)">
          <MinMaxInputs
            minValue={filters.dividend_yield_min}
            maxValue={filters.dividend_yield_max}
            onMinChange={(v) => updateFilter('dividend_yield_min', v)}
            onMaxChange={(v) => updateFilter('dividend_yield_max', v)}
          />
        </FilterGroup>

        {/* Profit Margin */}
        <FilterGroup label="Profit Margin (%)">
          <MinMaxInputs
            minValue={filters.profit_margin_min}
            maxValue={filters.profit_margin_max}
            onMinChange={(v) => updateFilter('profit_margin_min', v)}
            onMaxChange={(v) => updateFilter('profit_margin_max', v)}
          />
        </FilterGroup>

        {/* ROE */}
        <FilterGroup label="ROE (%)">
          <MinMaxInputs
            minValue={filters.roe_min}
            maxValue={filters.roe_max}
            onMinChange={(v) => updateFilter('roe_min', v)}
            onMaxChange={(v) => updateFilter('roe_max', v)}
          />
        </FilterGroup>

        {/* Revenue Growth */}
        <FilterGroup label="Revenue Growth (%)">
          <MinMaxInputs
            minValue={filters.revenue_growth_min}
            maxValue={filters.revenue_growth_max}
            onMinChange={(v) => updateFilter('revenue_growth_min', v)}
            onMaxChange={(v) => updateFilter('revenue_growth_max', v)}
          />
        </FilterGroup>

        {/* Apply button */}
        <button
          onClick={handleApply}
          className="w-full bg-accent hover:bg-accent-hover text-text-inverse font-body text-sm font-medium py-2.5 rounded-md transition-colors cursor-pointer border-none"
        >
          Apply Filters
        </button>
      </aside>

      {/* ============================================================
          Main — Results Table
         ============================================================ */}
      <section className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Stock Screener
          </h1>
          {!isLoading && (
            <span className="font-data text-xs text-text-tertiary">
              {sortedResults.length} result{sortedResults.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                      className={`px-3 py-3 text-left font-body text-xs font-medium text-text-secondary whitespace-nowrap ${
                        col.sortable
                          ? 'cursor-pointer select-none hover:text-text-primary transition-colors'
                          : ''
                      } ${col.numeric ? 'text-right' : ''}`}
                    >
                      {col.label}
                      {col.sortable && (
                        <SortIcon
                          direction={sortKey === col.key ? sortDir : null}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* Loading skeleton */}
                {isLoading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}

                {/* Empty state */}
                {!isLoading && sortedResults.length === 0 && (
                  <tr>
                    <td
                      colSpan={COLUMNS.length}
                      className="px-3 py-16 text-center"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-text-tertiary"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <p className="font-body text-sm text-text-secondary">
                          No companies match your filters
                        </p>
                        <button
                          onClick={handleClear}
                          className="font-body text-xs text-accent hover:text-accent-hover transition-colors bg-transparent border-none cursor-pointer"
                        >
                          Clear all filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {!isLoading &&
                  paginatedResults.map((row) => (
                    <tr
                      key={row.ticker}
                      onClick={() => handleRowClick(row.ticker)}
                      className="border-b border-border last:border-b-0 hover:bg-elevated cursor-pointer transition-colors"
                    >
                      {COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-3 ${col.numeric ? 'text-right' : ''}`}
                        >
                          {renderCell(row, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoading && sortedResults.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="font-body text-xs text-text-tertiary">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="font-body text-xs px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer bg-transparent"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="font-body text-xs px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer bg-transparent"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
