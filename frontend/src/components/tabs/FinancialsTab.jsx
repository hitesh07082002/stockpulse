import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { useFinancials } from '../../hooks/useStockData';

/* ────────────────────────────────────────────
   Format helpers
   ──────────────────────────────────────────── */

function formatLargeNumber(n) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function formatEPS(n) {
  if (n == null || isNaN(n)) return '—';
  return `$${Number(n).toFixed(2)}`;
}

function formatPercent(n) {
  if (n == null || isNaN(n)) return '—';
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function formatChartValue(value, metric) {
  if (value == null || isNaN(value)) return '—';
  if (PERCENT_METRICS.includes(metric)) return formatPercent(value);
  if (metric === 'diluted_eps') return formatEPS(value);
  return formatLargeNumber(value);
}

function formatYAxis(value, metric) {
  if (value == null || isNaN(value)) return '';
  if (PERCENT_METRICS.includes(metric)) {
    return `${(value * 100).toFixed(0)}%`;
  }
  if (metric === 'diluted_eps') return `$${value.toFixed(1)}`;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(0)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/* ────────────────────────────────────────────
   Metric definitions
   ──────────────────────────────────────────── */

const PERCENT_METRICS = [
  'gross_margin',
  'operating_margin',
  'net_margin',
  'roe',
];

const TOP_METRICS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'net_income', label: 'Net Income' },
  { key: 'diluted_eps', label: 'Diluted EPS' },
  { key: 'free_cash_flow', label: 'Free Cash Flow' },
];

const MORE_METRICS = [
  { key: 'gross_profit', label: 'Gross Profit' },
  { key: 'gross_margin', label: 'Gross Margin' },
  { key: 'operating_margin', label: 'Operating Margin' },
  { key: 'net_margin', label: 'Net Margin' },
  { key: 'total_debt', label: 'Total Debt' },
  { key: 'shareholders_equity', label: 'Shareholders Equity' },
  { key: 'roe', label: 'ROE' },
  { key: 'cash_and_equivalents', label: 'Cash & Equivalents' },
];

const LINE_METRICS = new Set([
  'gross_margin',
  'operating_margin',
  'net_margin',
  'roe',
]);

/* ────────────────────────────────────────────
   Data processing
   ──────────────────────────────────────────── */

function processFinancialData(rawData) {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return {};

  const grouped = {};

  for (const row of rawData) {
    const metric = row.metric_key;
    const value = row.value != null ? Number(row.value) : null;
    const fiscalYear = row.fiscal_year ?? null;
    const fiscalQuarter = row.fiscal_quarter ?? null;
    const isQuarterly = row.period_type === 'quarterly';
    const periodKey = isQuarterly
      ? `${fiscalYear}-Q${fiscalQuarter}`
      : String(fiscalYear ?? row.fiscal_period ?? row.period);
    const label = isQuarterly
      ? `${fiscalYear} Q${fiscalQuarter}`
      : String(fiscalYear ?? row.fiscal_period ?? row.period);
    const sortValue = isQuarterly
      ? ((fiscalYear ?? 0) * 10) + (fiscalQuarter ?? 0)
      : (fiscalYear ?? 0) * 10;

    if (!grouped[metric]) grouped[metric] = {};
    grouped[metric][periodKey] = {
      value,
      label,
      sortValue,
    };
  }

  return grouped;
}

function buildChartData(grouped, metric, periodType) {
  const allPeriods = new Map();
  for (const m of Object.keys(grouped)) {
    for (const [periodKey, meta] of Object.entries(grouped[m])) {
      if (!allPeriods.has(periodKey)) {
        allPeriods.set(periodKey, meta);
      }
    }
  }

  const periods = Array.from(allPeriods.entries())
    .sort(([, left], [, right]) => left.sortValue - right.sortValue);

  return periods.map(([periodKey, meta]) => {
    let value = null;

    if (metric === 'free_cash_flow') {
      const directFcf = grouped['free_cash_flow']?.[periodKey]?.value;
      if (directFcf != null) {
        value = directFcf;
      } else {
        const ocf = grouped['operating_cash_flow']?.[periodKey]?.value;
        const capex = grouped['capital_expenditures']?.[periodKey]?.value;
        if (ocf != null && capex != null) {
          value = ocf - Math.abs(capex);
        }
      }
    } else if (metric === 'gross_margin') {
      const gp = grouped['gross_profit']?.[periodKey]?.value;
      const rev = grouped['revenue']?.[periodKey]?.value;
      if (gp != null && rev != null && rev !== 0) {
        value = gp / rev;
      }
    } else if (metric === 'operating_margin') {
      const oi = grouped['operating_income']?.[periodKey]?.value;
      const rev = grouped['revenue']?.[periodKey]?.value;
      if (oi != null && rev != null && rev !== 0) {
        value = oi / rev;
      }
    } else if (metric === 'net_margin') {
      const ni = grouped['net_income']?.[periodKey]?.value;
      const rev = grouped['revenue']?.[periodKey]?.value;
      if (ni != null && rev != null && rev !== 0) {
        value = ni / rev;
      }
    } else {
      value = grouped[metric]?.[periodKey]?.value ?? null;
    }

    return {
      period: periodKey,
      value,
      label: periodType === 'quarterly' ? meta.label : String(meta.label),
    };
  }).filter((d) => d.value != null);
}

function computeYoY(chartData) {
  if (!chartData || chartData.length < 2) return null;
  const latest = chartData[chartData.length - 1].value;
  const previous = chartData[chartData.length - 2].value;
  if (previous == null || previous === 0) return null;
  return ((latest - previous) / Math.abs(previous)) * 100;
}

function getLatestValue(chartData) {
  if (!chartData || chartData.length === 0) return null;
  return chartData[chartData.length - 1].value;
}

/* ────────────────────────────────────────────
   Custom Tooltip
   ──────────────────────────────────────────── */

function CustomTooltip({ active, payload, label, metric }) {
  if (!active || !payload || !payload.length) return null;
  const value = payload[0].value;

  return (
    <div className="bg-elevated border border-border rounded-lg p-3 shadow-lg flex flex-col gap-0.5">
      <span className="font-body text-xs text-text-tertiary">{label}</span>
      <span className="font-data text-sm font-medium text-text-primary">
        {formatChartValue(value, metric)}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────
   Skeleton components
   ──────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-1 cursor-pointer text-left">
      <div className="skeleton w-3/5 h-3.5" />
      <div className="skeleton w-4/5 h-7 mt-2" />
      <div className="skeleton w-2/5 h-3 mt-1.5" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 min-h-[460px] flex items-center justify-center">
      <div className="skeleton w-full h-full rounded-lg" />
    </div>
  );
}

/* ────────────────────────────────────────────
   FinancialsTab
   ──────────────────────────────────────────── */

function FinancialsTab({ ticker }) {
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const [periodType, setPeriodType] = useState('annual');

  const { data: financialResponse, isLoading, isError, error } = useFinancials(ticker, {
    period_type: periodType,
  });
  const rawData = useMemo(() => financialResponse?.facts ?? [], [financialResponse]);

  const grouped = useMemo(() => processFinancialData(rawData), [rawData]);

  const topMetricData = useMemo(() => {
    const result = {};
    for (const m of TOP_METRICS) {
      result[m.key] = buildChartData(grouped, m.key, periodType);
    }
    return result;
  }, [grouped, periodType]);

  const chartData = useMemo(
    () => buildChartData(grouped, selectedMetric, periodType),
    [grouped, selectedMetric, periodType],
  );

  const selectedLabel =
    TOP_METRICS.find((m) => m.key === selectedMetric)?.label ||
    MORE_METRICS.find((m) => m.key === selectedMetric)?.label ||
    selectedMetric;
  const renderAsLine = LINE_METRICS.has(selectedMetric);

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-surface border border-error rounded-lg p-4 text-center">
          <p className="font-body text-sm text-error">
            {error?.message || 'Financial data unavailable. Try again later.'}
          </p>
        </div>
      </div>
    );
  }

  if (!isLoading && rawData.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <p className="font-body text-sm text-text-secondary">
            No financial data filed with the SEC for {ticker?.toUpperCase()}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---- A. Mini Metric Cards ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? TOP_METRICS.map((m) => <SkeletonCard key={m.key} />)
          : TOP_METRICS.map((m) => {
              const data = topMetricData[m.key];
              const latest = getLatestValue(data);
              const yoy = computeYoY(data);
              const isActive = selectedMetric === m.key;

              let displayValue;
              if (m.key === 'diluted_eps') {
                displayValue = formatEPS(latest);
              } else {
                displayValue = formatLargeNumber(latest);
              }

              return (
                <button
                  key={m.key}
                  className={`bg-surface border rounded-lg p-4 flex flex-col gap-1 cursor-pointer text-left hover:border-border-hover transition outline-none ${
                    isActive
                      ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]'
                      : 'border-border'
                  }`}
                  onClick={() => setSelectedMetric(m.key)}
                  aria-pressed={isActive}
                >
                  <span className="text-text-secondary text-sm">{m.label}</span>
                  <span className="font-data text-xl font-semibold text-text-primary">{displayValue}</span>
                  {yoy != null && (
                    <span
                      className={`text-sm font-data ${
                        yoy >= 0 ? 'text-up' : 'text-down'
                      }`}
                    >
                      {yoy >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(yoy).toFixed(1)}%
                    </span>
                  )}
                </button>
              );
            })}
      </div>

      {/* ---- B. Controls Bar ---- */}
      <div className="flex items-center gap-2">
        <button
          className={`px-4 py-1.5 rounded-full text-sm border cursor-pointer transition ${
            periodType === 'annual'
              ? 'bg-accent text-text-inverse border-accent'
              : 'border-border text-text-secondary'
          }`}
          onClick={() => setPeriodType('annual')}
        >
          Annual
        </button>
        <button
          className={`px-4 py-1.5 rounded-full text-sm border cursor-pointer transition ${
            periodType === 'quarterly'
              ? 'bg-accent text-text-inverse border-accent'
              : 'border-border text-text-secondary'
          }`}
          onClick={() => setPeriodType('quarterly')}
        >
          Quarterly
        </button>
      </div>

      {/* ---- C. Main Chart ---- */}
      {isLoading ? (
        <SkeletonChart />
      ) : (
        <div className="bg-surface border border-border rounded-lg p-4">
          <h4 className="font-display text-lg font-bold text-text-primary">{selectedLabel}</h4>
          {chartData.length > 0 ? (
            <div className="mt-4 w-full">
              <ResponsiveContainer width="100%" height={360} minWidth={0}>
                {renderAsLine ? (
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <ReferenceLine y={0} stroke="var(--color-text-secondary)" strokeOpacity={0.35} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatYAxis(v, selectedMetric)}
                      width={70}
                    />
                    <Tooltip
                      content={<CustomTooltip metric={selectedMetric} />}
                      cursor={{ stroke: 'var(--color-text-tertiary)', strokeDasharray: '3 3' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#14B8A6"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: '#14B8A6',
                        stroke: 'var(--color-surface)',
                        strokeWidth: 2,
                      }}
                    />
                  </LineChart>
                ) : (
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <ReferenceLine y={0} stroke="var(--color-text-secondary)" strokeOpacity={0.35} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatYAxis(v, selectedMetric)}
                      width={70}
                    />
                    <Tooltip
                      content={<CustomTooltip metric={selectedMetric} />}
                      cursor={{ fill: 'rgba(20, 184, 166, 0.08)' }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#14B8A6"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] w-full mt-4">
              <span className="font-body text-sm text-text-tertiary">
                No {selectedLabel.toLowerCase()} data filed with the SEC for {ticker?.toUpperCase()}.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ---- D. More Metrics ---- */}
      <div className="flex flex-col gap-4">
        <h4 className="font-display text-lg font-bold text-text-primary">More Metrics</h4>
        <div className="flex flex-wrap gap-2">
          {MORE_METRICS.map((m) => {
            const isActive = selectedMetric === m.key;
            return (
              <button
                key={m.key}
                className={`px-4 py-1.5 rounded-full text-sm border cursor-pointer transition outline-none whitespace-nowrap ${
                  isActive
                    ? 'bg-accent text-text-inverse border-accent'
                    : 'border-border text-text-secondary'
                }`}
                onClick={() => setSelectedMetric(m.key)}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default FinancialsTab;
