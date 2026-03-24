import React from 'react';
import {
  COLUMNS,
  INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
  SORTABLE_COLUMNS,
} from './screener-config';
import {
  formatMarketCap,
  formatNumber,
  formatPercent,
  formatPrice,
} from './screener-utils';

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

function PaginationControls({ page, totalPages, onPageChange, buttonClassName }) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <span className="font-body text-xs text-text-tertiary">Page {page} of {totalPages}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className={buttonClassName}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className={buttonClassName}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onClear, compact }) {
  return (
    <div className={compact
      ? 'rounded-xl border border-dashed border-border bg-base px-5 py-10 text-center'
      : 'px-6 py-16 text-center'}
    >
      <p className="font-body text-sm text-text-secondary">
        No companies match your filters. Try broadening your criteria.
      </p>
      <button
        type="button"
        onClick={onClear}
        className={compact
          ? 'mt-4 border-none bg-transparent font-body text-sm font-medium text-accent transition-colors hover:text-accent-hover'
          : 'mt-3 border-none bg-transparent font-body text-xs text-accent transition-colors hover:text-accent-hover'}
      >
        Reset filters
      </button>
    </div>
  );
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

export function ScreenerMobileSortControl({ sortDir, sortKey, onSort, onSortChange }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="mobile-sort" className="sr-only">
        Sort results
      </label>
      <select
        id="mobile-sort"
        value={sortKey}
        onChange={(event) => onSortChange(event.target.value)}
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
        onClick={() => onSort(sortKey)}
        className={SECONDARY_BUTTON_CLASS}
      >
        {sortDir === 'asc' ? 'Asc' : 'Desc'}
      </button>
    </div>
  );
}

export function ScreenerDesktopResults({
  isLoading,
  onClear,
  onPageChange,
  onSelect,
  onSort,
  page,
  results,
  sortDir,
  sortKey,
  totalPages,
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  onClick={column.sortable ? () => onSort(column.key) : undefined}
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
                <td colSpan={COLUMNS.length} className="px-0 py-0">
                  <EmptyState onClear={onClear} />
                </td>
              </tr>
            ) : null}

            {!isLoading ? results.map((row) => (
              <tr
                key={row.ticker}
                onClick={() => onSelect(row.ticker)}
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
        <PaginationControls
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          buttonClassName="rounded-md border border-border bg-transparent px-3 py-1.5 font-body text-xs text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        />
      ) : null}
    </>
  );
}

export function ScreenerMobileResults({
  isLoading,
  onClear,
  onPageChange,
  onSelect,
  page,
  results,
  totalPages,
}) {
  return (
    <>
      <div className="flex flex-col gap-3 p-4">
        {isLoading ? Array.from({ length: 6 }).map((_, index) => <ScreenerCardSkeleton key={index} />) : null}

        {!isLoading && results.length === 0 ? (
          <EmptyState onClear={onClear} compact />
        ) : null}

        {!isLoading ? results.map((row) => (
          <ScreenerResultCard
            key={row.ticker}
            row={row}
            onSelect={onSelect}
          />
        )) : null}
      </div>

      {!isLoading && totalPages > 1 ? (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          buttonClassName={SECONDARY_BUTTON_CLASS}
        />
      ) : null}
    </>
  );
}
