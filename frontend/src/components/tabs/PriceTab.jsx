import { useState, useRef, useEffect, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { usePrices } from '../../hooks/useStockData';

/* ────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────── */

const RANGES = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

/* Hardcoded color values — lightweight-charts cannot resolve CSS variables */
const COLORS = {
  bgTransparent: 'transparent',
  textSecondaryDark: '#A1A1AA',
  textSecondaryLight: '#52525B',
  gridLine: '#27272A',
  up: '#4ADE80',
  down: '#F87171',
  volumeTeal: 'rgba(20, 184, 166, 0.3)',
  volumeUp: 'rgba(74, 222, 128, 0.3)',
  volumeDown: 'rgba(248, 113, 113, 0.3)',
};

/* ────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────── */

function resolveTextColor() {
  if (typeof window === 'undefined') return COLORS.textSecondaryDark;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--text-secondary')
    .trim();
  return value || COLORS.textSecondaryDark;
}

function formatStaleness(updatedAt) {
  if (!updatedAt) return null;
  const diff = Date.now() - new Date(updatedAt).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return null;
  return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
}

/* ────────────────────────────────────────────
   Skeleton placeholder
   ──────────────────────────────────────────── */

function ChartSkeleton() {
  return (
    <div className="w-full h-[500px] skeleton rounded-lg" />
  );
}

/* ────────────────────────────────────────────
   PriceTab
   ──────────────────────────────────────────── */

function PriceTab({ ticker, company }) {
  const [selectedRange, setSelectedRange] = useState('1Y');
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  const { data, isLoading, isError, error } = usePrices(ticker, selectedRange);

  /* ---- Create chart on mount ---- */
  useEffect(() => {
    if (!containerRef.current) return;

    const textColor = resolveTextColor();

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: COLORS.bgTransparent },
        textColor: textColor,
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
        mode: 0, // Normal crosshair
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: COLORS.up,
      downColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      borderUpColor: COLORS.up,
      borderDownColor: COLORS.down,
    });

    const volumeSeries = chart.addHistogramSeries({
      color: COLORS.volumeTeal,
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  /* ---- Handle window resize ---- */
  useEffect(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container) return;

    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ---- Update series data when data changes ---- */
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;

    if (!data || !data.prices || data.prices.length === 0) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      return;
    }

    const candles = data.prices.map((d) => ({
      time: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumes = data.prices.map((d) => ({
      time: d.date,
      value: d.volume,
      color: d.close >= d.open ? COLORS.volumeUp : COLORS.volumeDown,
    }));

    candleSeries.setData(candles);
    volumeSeries.setData(volumes);
    chart.timeScale().fitContent();
  }, [data]);

  /* ---- Staleness message ---- */
  const stalenessMsg =
    data?.stale && data?.updated_at
      ? formatStaleness(data.updated_at)
      : data?.stale
        ? 'Data may be stale'
        : null;

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Timeframe Selector ---- */}
      <div className="flex gap-2 mb-4">
        {RANGES.map((range) => (
          <button
            key={range}
            onClick={() => setSelectedRange(range)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border cursor-pointer transition ${
              selectedRange === range
                ? 'bg-accent text-text-inverse border-accent'
                : 'border-border text-text-secondary hover:bg-elevated'
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* ---- Staleness Badge ---- */}
      {stalenessMsg && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F59E0B]/10 text-[#F59E0B] rounded-full text-sm mt-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{stalenessMsg}</span>
        </div>
      )}

      {/* ---- Chart Area ---- */}
      {isLoading && <ChartSkeleton />}

      {isError && (
        <div className="text-center py-12 text-error">
          Failed to load price data
          {error?.message ? `: ${error.message}` : '.'}
        </div>
      )}

      <div
        ref={containerRef}
        className={`w-full h-[500px] rounded-lg overflow-hidden ${
          isLoading ? 'invisible h-0 overflow-hidden' : ''
        }`}
      />
    </div>
  );
}

export default PriceTab;
