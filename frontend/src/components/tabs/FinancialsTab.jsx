import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

function formatRatio(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toFixed(2);
}

function formatChartValue(value, metric) {
  if (value == null || isNaN(value)) return '—';
  if (PERCENT_METRICS.includes(metric)) return formatPercent(value);
  if (metric === 'eps') return formatEPS(value);
  if (metric === 'debt_equity') return formatRatio(value);
  return formatLargeNumber(value);
}

function formatYAxis(value, metric) {
  if (value == null || isNaN(value)) return '';
  if (PERCENT_METRICS.includes(metric)) {
    return `${(value * 100).toFixed(0)}%`;
  }
  if (metric === 'eps') return `$${value.toFixed(1)}`;
  if (metric === 'debt_equity') return value.toFixed(1);
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
  { key: 'eps', label: 'EPS' },
  { key: 'free_cash_flow', label: 'Free Cash Flow' },
];

const MORE_METRICS = [
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'gross_margin', label: 'Gross Margin' },
  { key: 'operating_margin', label: 'Operating Margin' },
  { key: 'net_margin', label: 'Net Margin' },
  { key: 'total_debt', label: 'Total Debt' },
  { key: 'debt_equity', label: 'Debt/Equity' },
  { key: 'roe', label: 'ROE' },
  { key: 'cash_and_equivalents', label: 'Cash & Equivalents' },
];

/* ────────────────────────────────────────────
   Data processing
   ──────────────────────────────────────────── */

function processFinancialData(rawData) {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return {};

  const grouped = {};

  for (const row of rawData) {
    const metric = row.metric;
    const period = row.fiscal_year || row.fiscal_period || row.period;
    const value = row.value != null ? Number(row.value) : null;

    if (!grouped[metric]) grouped[metric] = {};
    grouped[metric][period] = value;
  }

  return grouped;
}

function buildChartData(grouped, metric, periodType) {
  // Get all periods from all metrics so we have a full timeline
  const allPeriods = new Set();
  for (const m of Object.keys(grouped)) {
    for (const p of Object.keys(grouped[m])) {
      allPeriods.add(p);
    }
  }

  const periods = Array.from(allPeriods).sort();

  // Compute derived metrics
  return periods.map((period) => {
    let value = null;

    if (metric === 'free_cash_flow') {
      const ocf = grouped['operating_cash_flow']?.[period];
      const capex = grouped['capital_expenditures']?.[period];
      if (ocf != null && capex != null) {
        value = ocf - Math.abs(capex);
      }
    } else if (metric === 'gross_margin') {
      const gp = grouped['gross_profit']?.[period];
      const rev = grouped['revenue']?.[period];
      if (gp != null && rev != null && rev !== 0) {
        value = gp / rev;
      }
    } else if (metric === 'operating_margin') {
      const oi = grouped['operating_income']?.[period];
      const rev = grouped['revenue']?.[period];
      if (oi != null && rev != null && rev !== 0) {
        value = oi / rev;
      }
    } else if (metric === 'net_margin') {
      const ni = grouped['net_income']?.[period];
      const rev = grouped['revenue']?.[period];
      if (ni != null && rev != null && rev !== 0) {
        value = ni / rev;
      }
    } else {
      value = grouped[metric]?.[period] ?? null;
    }

    return {
      period,
      value,
      label: periodType === 'quarterly' ? period : String(period),
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

function FinancialsTab({ ticker, company }) {
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const [periodType, setPeriodType] = useState('annual');

  const { data: rawData, isLoading, isError, error } = useFinancials(ticker, {
    period_type: periodType,
  });

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

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-surface border border-error rounded-lg p-4 text-center">
          <p className="font-body text-sm text-error">
            {error?.message || 'Failed to load financial data. Please try again.'}
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
              if (m.key === 'eps') {
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
            <div className="h-[400px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="accentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#14B8A6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
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
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#14B8A6"
                    strokeWidth={2}
                    fill="url(#accentGradient)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: '#14B8A6',
                      stroke: 'var(--color-surface)',
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] w-full mt-4">
              <span className="font-body text-sm text-text-tertiary">
                No data available for {selectedLabel}
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
