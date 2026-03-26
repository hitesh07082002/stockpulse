import React, { useMemo, useState } from 'react';
import { usePrices } from '../../hooks/useStockData';
import {
  StockDetailChartStage,
  StockDetailSection,
  StockDetailStatePanel,
} from '../stock-detail/StockDetailPrimitives';
import {
  ChartToolbarRail,
  ChartWorkspaceShell,
} from '../stock-detail/StockDetailWorkspace';
import { usePriceChartModel } from './price/usePriceChartModel';

const RANGES = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

const COLORS = {
  warningBg: 'rgba(245, 158, 11, 0.12)',
  warningText: '#F59E0B',
};

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}

function formatPriceLabel(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `$${Number(value).toFixed(2)}`;
}

function formatVolumeLabel(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const absolute = Math.abs(Number(value));

  if (absolute >= 1_000_000_000) {
    return `${(absolute / 1_000_000_000).toFixed(2)}B shares`;
  }

  if (absolute >= 1_000_000) {
    return `${(absolute / 1_000_000).toFixed(2)}M shares`;
  }

  if (absolute >= 1_000) {
    return `${(absolute / 1_000).toFixed(2)}K shares`;
  }

  return `${absolute.toFixed(0)} shares`;
}

function formatFreshnessLabel(timestamp) {
  if (!timestamp) return null;

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (minutes < 60) {
    return `Last updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Last updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  return `Last updated ${days} day${days === 1 ? '' : 's'} ago`;
}

function ChartSkeleton() {
  return (
    <StockDetailChartStage preset="price">
      <div className="h-full w-full rounded-xl skeleton" />
    </StockDetailChartStage>
  );
}

function ReadoutChip({ children, emphasis = false }) {
  return (
    <span
      className={joinClasses(
        'rounded-full border px-3 py-1 text-xs',
        emphasis
          ? 'border-accent/40 bg-accent/10 text-text-primary'
          : 'border-border bg-surface text-text-tertiary',
      )}
    >
      {children}
    </span>
  );
}

function PriceTab({ ticker }) {
  const [selectedRange, setSelectedRange] = useState('1Y');
  const [showVolume, setShowVolume] = useState(false);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = usePrices(ticker, selectedRange);

  const prices = useMemo(() => data?.data ?? [], [data]);
  const hasPrices = prices.length > 0;
  const staleLabel = data?.stale
    ? formatFreshnessLabel(data?.fetched_at || data?.quote_updated_at) || 'Stale'
    : null;
  const latestPoint = useMemo(() => prices.at(-1) ?? null, [prices]);
  const { chartHostRef, chartReadout } = usePriceChartModel({
    hasPrices,
    prices,
    latestPoint,
    showVolume,
  });
  const workspaceState = (isLoading || (isFetching && !hasPrices))
    ? <ChartSkeleton />
    : isError
      ? (
        <StockDetailStatePanel
          tone="error"
          height="price"
          message={error?.message || 'Price data unavailable. Retry.'}
        />
      )
      : !hasPrices
        ? (
          <StockDetailStatePanel
            height="price"
            message={data?.message || 'No price history available'}
          />
        )
        : null;

  return (
    <StockDetailSection
      title="Adjusted Close"
      subtitle="Price history for the selected range, with optional daily volume context."
      bodyClassName="gap-4"
    >
      <ChartWorkspaceShell
        toolbar={(
          <ChartToolbarRail>
              {RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  aria-pressed={selectedRange === range}
                  onClick={() => setSelectedRange(range)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition cursor-pointer ${
                    selectedRange === range
                      ? 'border-accent bg-accent text-text-inverse'
                      : 'border-border text-text-secondary hover:bg-elevated'
                  }`}
                  >
                    {range}
                  </button>
                ))}
          </ChartToolbarRail>
        )}
        readout={hasPrices ? (
          <>
            {chartReadout.dateLabel ? (
              <ReadoutChip>{chartReadout.dateLabel}</ReadoutChip>
            ) : null}
            <ReadoutChip emphasis>{`Price ${formatPriceLabel(chartReadout.price)}`}</ReadoutChip>
            {showVolume && chartReadout.volume != null ? (
              <ReadoutChip>{`Volume ${formatVolumeLabel(chartReadout.volume)}`}</ReadoutChip>
            ) : null}
          </>
        ) : null}
        actions={(
          <>
            <button
              type="button"
              aria-pressed={showVolume}
              onClick={() => setShowVolume((current) => !current)}
              className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition ${
                showVolume
                  ? 'border-accent bg-accent text-text-inverse'
                  : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:text-text-primary'
              }`}
            >
              {showVolume ? 'Hide volume' : 'Show volume'}
            </button>
            {showVolume ? (
              <ReadoutChip>Daily shares traded</ReadoutChip>
            ) : null}
            {staleLabel ? (
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: COLORS.warningBg, color: COLORS.warningText }}
              >
                Stale · {staleLabel}
              </span>
            ) : null}
          </>
        )}
        state={workspaceState}
        chart={!isLoading && !isError && hasPrices ? (
          <StockDetailChartStage
            preset="price"
            className="rounded-none border-y border-border bg-base/20 sm:rounded-xl sm:border"
          >
            <div
              ref={chartHostRef}
              className="h-full w-full"
            />
          </StockDetailChartStage>
        ) : null}
        bleedChart
      />
    </StockDetailSection>
  );
}

export default PriceTab;
