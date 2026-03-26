import { useEffect, useRef, useState } from 'react';
import { createChart, HistogramSeries, LineSeries } from 'lightweight-charts';
import { useChartHostSize } from '../../stock-detail/useChartHostSize';

const COLORS = {
  bgTransparent: 'transparent',
  textSecondaryDark: '#A1A1AA',
  gridLine: '#27272A',
  accent: '#14B8A6',
  volumeUp: 'rgba(20, 184, 166, 0.32)',
  volumeDown: 'rgba(244, 63, 94, 0.24)',
};

function resolveTextColor() {
  if (typeof window === 'undefined') return COLORS.textSecondaryDark;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-text-secondary')
    .trim();
  return value || COLORS.textSecondaryDark;
}

export function formatChartDateLabel(value) {
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

function applyEdgePadding(chart, width) {
  const timeScale = chart.timeScale();
  if (typeof timeScale.getVisibleLogicalRange !== 'function'
    || typeof timeScale.setVisibleLogicalRange !== 'function') {
    return;
  }

  const logicalRange = timeScale.getVisibleLogicalRange();
  if (!logicalRange) return;

  const edgePadding = width > 0 && width < 480 ? 1.1 : 0.6;
  timeScale.setVisibleLogicalRange({
    from: logicalRange.from - edgePadding,
    to: logicalRange.to + edgePadding,
  });
}

export function usePriceChartModel({
  hasPrices,
  prices,
  latestPoint,
  showVolume,
}) {
  const { hostRef, hostNode, chartSize } = useChartHostSize();
  const [chartReadout, setChartReadout] = useState({
    dateLabel: null,
    price: null,
    volume: null,
  });
  const chartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  useEffect(() => {
    setChartReadout(buildReadout(latestPoint, showVolume));
  }, [latestPoint, showVolume]);

  useEffect(() => {
    const host = hostNode;
    if (!host || !hasPrices) return undefined;

    const chart = createChart(host, {
      width: host.clientWidth || 300,
      height: host.clientHeight || 280,
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

    chartRef.current = chart;
    priceSeriesRef.current = priceSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [hasPrices, hostNode]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !hasPrices) return;

    if (showVolume && !volumeSeriesRef.current) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
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

      volumeSeriesRef.current = volumeSeries;
      return;
    }

    if (!showVolume && volumeSeriesRef.current) {
      if (typeof chart.removeSeries === 'function') {
        chart.removeSeries(volumeSeriesRef.current);
      }
      volumeSeriesRef.current = null;
    }
  }, [hasPrices, showVolume]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !chartSize.width || !chartSize.height) return;

    chart.applyOptions({
      width: chartSize.width,
      height: chartSize.height,
    });
  }, [chartSize.height, chartSize.width]);

  useEffect(() => {
    const chart = chartRef.current;
    const priceSeries = priceSeriesRef.current;
    if (!chart || !priceSeries || !hasPrices) return;

    priceSeries.setData(
      prices.map((point) => ({
        time: point.date,
        value: Number(point.adjusted_close ?? point.close),
      })),
    );

    const volumeSeries = volumeSeriesRef.current;
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
    applyEdgePadding(chart, chartSize.width);
  }, [chartSize.width, hasPrices, prices, showVolume]);

  useEffect(() => {
    const chart = chartRef.current;
    const priceSeries = priceSeriesRef.current;
    if (!chart || !priceSeries || !hasPrices) return undefined;

    const handleCrosshairMove = (param) => {
      const fallbackReadout = buildReadout(latestPoint, showVolume);
      if (!param?.time || !param?.seriesData) {
        setChartReadout(fallbackReadout);
        return;
      }

      const volumeSeries = volumeSeriesRef.current;
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

  return {
    chartHostRef: hostRef,
    chartReadout,
  };
}
