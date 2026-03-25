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

function formatChartDateLabel(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function buildReadout(point, showVolume) {
  if (!point) {
    return {
      dateLabel: null,
      price: null,
      volume: null,
    };
  }

  return {
    dateLabel: formatChartDateLabel(point.date),
    price: Number(point.adjusted_close ?? point.close),
    volume: showVolume ? Number(point.volume ?? 0) : null,
  };
}

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
  const [showVolume, setShowVolume] = useState(false);
  const [chartReadout, setChartReadout] = useState({
    dateLabel: null,
    price: null,
    volume: null,
  });
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
  const latestPoint = useMemo(() => prices.at(-1) ?? null, [prices]);

  useEffect(() => {
    setChartReadout(buildReadout(latestPoint, showVolume));
  }, [latestPoint, showVolume]);

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

    let volumeSeries = null;
    if (showVolume) {
      volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
    }

    chartRef.current = chart;
    priceSeriesRef.current = priceSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [hasPrices, selectedRange, showVolume]);

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
    if (!chart || !priceSeries || !hasPrices) return;

    priceSeries.setData(
      prices.map((point) => ({
        time: point.date,
        value: Number(point.adjusted_close ?? point.close),
      })),
    );

    if (showVolume && volumeSeries) {
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
    }

    chart.timeScale().fitContent();
  }, [hasPrices, prices, showVolume]);

  useEffect(() => {
    const chart = chartRef.current;
    const priceSeries = priceSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !priceSeries || !hasPrices) return undefined;

    const fallbackReadout = buildReadout(latestPoint, showVolume);
    const handleCrosshairMove = (param) => {
      if (!param?.time || !param?.seriesData) {
        setChartReadout(fallbackReadout);
        return;
      }

      const priceData = param.seriesData.get(priceSeries);
      const volumeData = volumeSeries ? param.seriesData.get(volumeSeries) : null;
      setChartReadout({
        dateLabel: formatChartDateLabel(param.time),
        price: typeof priceData?.value === 'number' ? priceData.value : fallbackReadout.price,
        volume: showVolume && typeof volumeData?.value === 'number'
          ? volumeData.value
          : fallbackReadout.volume,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    return () => chart.unsubscribeCrosshairMove(handleCrosshairMove);
  }, [hasPrices, latestPoint, showVolume]);

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
          <button
            type="button"
            aria-pressed={showVolume}
            onClick={() => setShowVolume((current) => !current)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              showVolume
                ? 'border-accent bg-accent text-text-inverse'
                : 'border-border bg-surface text-text-tertiary hover:border-border-hover hover:text-text-primary'
            }`}
          >
            {showVolume ? 'Hide volume' : 'Show volume'}
          </button>
          {showVolume ? (
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-tertiary">
              Daily shares traded
            </span>
          ) : null}
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

      {hasPrices ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
          {chartReadout.dateLabel ? (
            <span className="rounded-full border border-border bg-surface px-3 py-1">
              {chartReadout.dateLabel}
            </span>
          ) : null}
          <span className="rounded-full border border-border bg-surface px-3 py-1">
            {`Price ${formatPriceLabel(chartReadout.price)}`}
          </span>
          {showVolume && chartReadout.volume != null ? (
            <span className="rounded-full border border-border bg-surface px-3 py-1">
              {`Volume ${formatVolumeLabel(chartReadout.volume)}`}
            </span>
          ) : null}
        </div>
      ) : null}

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
