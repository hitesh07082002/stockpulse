import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScreenerFiltersPanel,
  ScreenerMobileFilterSheet,
} from '../components/screener/ScreenerFiltersPanel';
import {
  ScreenerDesktopResults,
  ScreenerMobileResults,
  ScreenerMobileSortControl,
} from '../components/screener/ScreenerResults';
import { SECONDARY_BUTTON_CLASS } from '../components/screener/screener-config';
import { useMinWidth } from '../hooks/useMinWidth';
import { useScreenerControls } from '../hooks/useScreenerControls';
import { useScreener } from '../hooks/useStockData';

function MobileScreenerHeader({
  activeFilterCount,
  isFetching,
  isLoading,
  onClear,
  onOpenFilters,
  resultSummary,
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
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
              {isFetching && !isLoading ? 'Refreshing...' : resultSummary}
            </span>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-elevated px-2.5 py-1 font-data text-[11px] text-text-secondary">
                {activeFilterCount} active
              </span>
            ) : null}
            <button
              type="button"
              onClick={onOpenFilters}
              className={SECONDARY_BUTTON_CLASS}
            >
              Filters
            </button>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className={SECONDARY_BUTTON_CLASS}
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScreenerPage() {
  const navigate = useNavigate();
  const isDesktop = useMinWidth(1024);
  const controls = useScreenerControls({ isDesktop });

  const { data, isLoading, isError, error, isFetching } = useScreener(
    controls.appliedFilters,
    controls.sortKey,
    controls.sortDir,
    controls.page,
  );

  const results = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const pageSize = results.length > 0 ? results.length : 25;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const resultSummary = useMemo(() => {
    if (isLoading) {
      return 'Loading...';
    }
    return `${totalCount} result${totalCount === 1 ? '' : 's'}`;
  }, [isLoading, totalCount]);

  const filterPanelProps = {
    activeFilterCount: controls.activeFilterCount,
    filters: controls.filters,
    onApply: controls.applyFilters,
    onClear: controls.clearFilters,
    onMarketCapPreset: controls.applyMarketCapPreset,
    onToggleMoreFilters: controls.toggleMoreFilters,
    onUpdateFilter: controls.updateFilter,
    showMoreFilters: controls.showMoreFilters,
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {isDesktop ? (
        <aside className="w-full shrink-0 lg:w-80">
          <ScreenerFiltersPanel
            {...filterPanelProps}
            showHeading
          />
        </aside>
      ) : (
        <MobileScreenerHeader
          activeFilterCount={controls.activeFilterCount}
          isFetching={isFetching}
          isLoading={isLoading}
          onClear={controls.clearFilters}
          onOpenFilters={controls.openMobileFilters}
          resultSummary={resultSummary}
        />
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
              {isFetching && !isLoading ? 'Refreshing...' : resultSummary}
            </span>
          ) : (
            <ScreenerMobileSortControl
              sortDir={controls.sortDir}
              sortKey={controls.sortKey}
              onSort={controls.sortBy}
              onSortChange={controls.changeSortKey}
            />
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
            <ScreenerDesktopResults
              isLoading={isLoading}
              onClear={controls.clearFilters}
              onPageChange={controls.setPage}
              onSelect={(nextTicker) => navigate(`/stock/${nextTicker}`)}
              onSort={controls.sortBy}
              page={controls.page}
              results={results}
              sortDir={controls.sortDir}
              sortKey={controls.sortKey}
              totalPages={totalPages}
            />
          ) : (
            <ScreenerMobileResults
              isLoading={isLoading}
              onClear={controls.clearFilters}
              onPageChange={controls.setPage}
              onSelect={(nextTicker) => navigate(`/stock/${nextTicker}`)}
              page={controls.page}
              results={results}
              totalPages={totalPages}
            />
          )}
        </div>
      </section>

      <ScreenerMobileFilterSheet
        {...filterPanelProps}
        isOpen={!isDesktop && controls.showMobileFilters}
        onClose={controls.closeMobileFilters}
      />
    </div>
  );
}
