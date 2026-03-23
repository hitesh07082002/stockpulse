import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, HistogramSeries, LineSeries } from 'lightweight-charts';
import { usePrices } from '../../hooks/useStockData';

const RANGES = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

const COLORS = {
  bgTransparent: 'transparent',
  textSecondaryDark: '#A1A1AA',
  gridLine: '#27272A',
  accent: '#14B8A6',
  volumeUp: 'rgba(20, 184, 166, 0.32)',
  volumeDown: 'rgba(244, 63, 94, 0.24)',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  warningText: '#F59E0B',
};

function resolveTextColor() {
  if (typeof window === 'undefined') return COLORS.textSecondaryDark;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-text-secondary')
    .trim();
  return value || COLORS.textSecondaryDark;
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
  return <div className="h-[500px] w-full rounded-lg skeleton" />;
}

function StatePanel({ message, tone = 'default' }) {
  const toneClass = tone === 'error'
    ? 'border-error text-error'
    : 'border-border text-text-secondary';

  return (
    <div className={`flex h-[500px] items-center justify-center rounded-lg border bg-surface px-6 text-center ${toneClass}`}>
      <p className="font-body text-base">{message}</p>
    </div>
  );
}

function PriceTab({ ticker }) {
  const [selectedRange, setSelectedRange] = useState('1Y');
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

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

  useEffect(() => {
    if (!containerRef.current || !hasPrices) return undefined;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 300,
      height: 500,
      layout: {
        background: { color: COLORS.bgTransparent },
        textColor: resolveTextColor(),
      },
      grid: {
        vertLines: { color: COLORS.gridLine },
        horzLines: { color: COLORS.gridLine },
      },
      timeScale: {
        borderColor: COLORS.gridLine,
      },
      rightPriceScale: {
        borderColor: COLORS.gridLine,
      },
      crosshair: {
        mode: 0,
      },
    });

    const priceSeries = chart.addSeries(LineSeries, {
      color: COLORS.accent,
      lineWidth: 2.5,
      priceLineVisible: false,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: COLORS.accent,
      crosshairMarkerBackgroundColor: '#09090B',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    priceSeriesRef.current = priceSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [hasPrices, selectedRange]);

  useEffect(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container) return undefined;

    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth || 300 });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hasPrices]);

  useEffect(() => {
    const chart = chartRef.current;
    const priceSeries = priceSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !priceSeries || !volumeSeries || !hasPrices) return;

    priceSeries.setData(
      prices.map((point) => ({
        time: point.date,
        value: Number(point.adjusted_close ?? point.close),
      })),
    );

    volumeSeries.setData(
      prices.map((point) => ({
        time: point.date,
        value: Number(point.volume ?? 0),
        color:
          Number(point.adjusted_close ?? point.close) >= Number(point.open ?? point.close)
            ? COLORS.volumeUp
            : COLORS.volumeDown,
      })),
    );

    chart.timeScale().fitContent();
  }, [hasPrices, prices]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={selectedRange === range}
              onClick={() => setSelectedRange(range)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition cursor-pointer ${
                selectedRange === range
                  ? 'border-accent bg-accent text-text-inverse'
                  : 'border-border text-text-secondary hover:bg-elevated'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-tertiary">
            Adjusted close
          </span>
          {staleLabel ? (
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: COLORS.warningBg, color: COLORS.warningText }}
            >
              Stale · {staleLabel}
            </span>
          ) : null}
        </div>
      </div>

      {(isLoading || (isFetching && !hasPrices)) ? <ChartSkeleton /> : null}

      {!isLoading && isError ? (
        <StatePanel
          tone="error"
          message={error?.message || 'Price data unavailable. Retry.'}
        />
      ) : null}

      {!isLoading && !isError && !hasPrices ? (
        <StatePanel message={data?.message || 'No price history available'} />
      ) : null}

      {!isLoading && !isError && hasPrices ? (
        <div
          ref={containerRef}
          className="h-[500px] w-full overflow-hidden rounded-lg"
        />
      ) : null}
    </div>
  );
}

export default PriceTab;
