import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useValuationInputs } from '../../hooks/useStockData';

const MODE_OPTIONS = [
  { key: 'earnings', label: 'Earnings' },
  { key: 'cashFlow', label: 'Cash Flow' },
];

function toNumber(value) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatPercentWithoutSign(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)}%`;
}

function formatCompact(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(2);
}

function buildProjection(currentMetric, growthRate, terminalMultiple, years, currentPrice) {
  if (
    currentMetric == null || currentMetric <= 0
    || growthRate == null
    || terminalMultiple == null || terminalMultiple <= 0
    || years <= 0
  ) {
    return [];
  }

  const data = [];
  if (currentPrice != null && currentPrice > 0) {
    data.push({
      label: 'Today',
      projectedPrice: currentPrice,
      projectedMetric: currentMetric,
    });
  }

  for (let year = 1; year <= years; year += 1) {
    const projectedMetric = currentMetric * ((1 + growthRate / 100) ** year);
    data.push({
      label: `Y${year}`,
      projectedMetric,
      projectedPrice: projectedMetric * terminalMultiple,
    });
  }

  return data;
}

function ProjectionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-elevated p-3 shadow-lg">
      <span className="font-body text-xs text-text-tertiary">{point.label}</span>
      <span className="font-data text-sm font-medium text-text-primary">
        {formatCurrency(point.projectedPrice)}
      </span>
      <span className="font-data text-xs text-text-secondary">
        Metric {formatCompact(point.projectedMetric)}
      </span>
    </div>
  );
}

function ProjectionChart({ data }) {
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(640);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      const nextWidth = Math.max(element.clientWidth || 0, 320);
      setChartWidth(nextWidth);
    };

    updateWidth();

    if (typeof ResizeObserver !== 'function') {
      return undefined;
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-[340px] w-full">
      <LineChart data={data} width={chartWidth} height={340} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value) => `$${value.toFixed(0)}`}
          tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip content={<ProjectionTooltip />} />
        <Line
          type="monotone"
          dataKey="projectedPrice"
          stroke="var(--color-accent)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: 'var(--color-accent)' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </div>
  );
}

function AssumptionField({ label, suffix, helper, value, onChange, step = '0.1' }) {
  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="font-body text-sm font-medium text-text-secondary">{label}</span>
        {suffix ? <span className="font-data text-xs text-text-tertiary">{suffix}</span> : null}
      </div>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-border bg-elevated px-3 py-2 font-data text-base text-text-primary outline-none transition focus:border-accent"
      />
      {helper ? <span className="font-body text-xs text-text-tertiary">{helper}</span> : null}
    </label>
  );
}

function StatePanel({ message, tone = 'default' }) {
  const toneClass = tone === 'error'
    ? 'border-error text-error'
    : 'border-border text-text-secondary';

  return (
    <div className={`rounded-lg border bg-surface px-6 py-10 text-center ${toneClass}`}>
      <p className="font-body text-base">{message}</p>
    </div>
  );
}

function WarningList({ warnings }) {
  if (!warnings?.length) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] px-4 py-4">
      {warnings.map((warning) => (
        <p key={warning} className="font-body text-sm text-[#F59E0B]">
          {warning}
        </p>
      ))}
    </div>
  );
}

function ValuationTab({ ticker }) {
  const { data, isLoading, error } = useValuationInputs(ticker);
  const [modeKey, setModeKey] = useState('earnings');
  const [draftByMode, setDraftByMode] = useState({});

  const currentPrice = toNumber(data?.current_price);
  const projectionYears = Number(data?.projection_years_default || 5);
  const modeData = modeKey === 'cashFlow' ? data?.cash_flow_mode : data?.earnings_mode;
  const modeDraft = draftByMode[modeKey] || {};
  const currentMetric = modeDraft.currentMetric
    ?? (modeData?.current_metric_value != null ? String(modeData.current_metric_value) : '');
  const growthRate = modeDraft.growthRate
    ?? (modeData?.growth_rate_default != null ? String(modeData.growth_rate_default) : '');
  const terminalMultiple = modeDraft.terminalMultiple
    ?? (modeData?.terminal_multiple_default != null ? String(modeData.terminal_multiple_default) : '');
  const desiredReturn = modeDraft.desiredReturn
    ?? (modeData?.desired_return_default != null ? String(modeData.desired_return_default) : '');

  function updateModeDraft(field, value) {
    setDraftByMode((current) => ({
      ...current,
      [modeKey]: {
        ...(current[modeKey] || {}),
        [field]: value,
      },
    }));
  }

  const metricValue = toNumber(currentMetric);
  const growthValue = toNumber(growthRate);
  const multipleValue = toNumber(terminalMultiple);
  const desiredReturnValue = toNumber(desiredReturn);
  const projectionBlocked = data?.not_applicable
    || !modeData?.available
    || metricValue == null
    || metricValue <= 0
    || growthValue == null
    || multipleValue == null
    || multipleValue <= 0;

  const projectionData = useMemo(
    () => (projectionBlocked
      ? []
      : buildProjection(metricValue, growthValue, multipleValue, projectionYears, currentPrice)),
    [projectionBlocked, metricValue, growthValue, multipleValue, projectionYears, currentPrice],
  );

  const futurePrice = projectionData.at(-1)?.projectedPrice ?? null;
  const annualizedReturn = useMemo(() => {
    if (futurePrice == null || currentPrice == null || currentPrice <= 0) return null;
    return (((futurePrice / currentPrice) ** (1 / projectionYears)) - 1) * 100;
  }, [futurePrice, currentPrice, projectionYears]);
  const totalReturn = useMemo(() => {
    if (futurePrice == null || currentPrice == null || currentPrice <= 0) return null;
    return ((futurePrice - currentPrice) / currentPrice) * 100;
  }, [futurePrice, currentPrice]);

  const entryPrice = useMemo(() => {
    if (futurePrice == null || desiredReturnValue == null) return null;
    return futurePrice / ((1 + desiredReturnValue / 100) ** projectionYears);
  }, [futurePrice, desiredReturnValue, projectionYears]);

  if (isLoading) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="h-[560px] rounded-2xl skeleton" />
        <div className="h-[560px] rounded-2xl skeleton" />
      </div>
    );
  }

  if (error) {
    return <StatePanel tone="error" message="Valuation inputs unavailable" />;
  }

  if (data?.not_applicable) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-surface p-6">
          <h3 className="font-display text-2xl font-semibold text-text-primary">DCF Calculator</h3>
          <WarningList warnings={data?.warnings} />
        </section>
        <StatePanel message={data?.not_applicable_reason || 'Not applicable for financial sector companies'} />
      </div>
    );
  }

  if (!modeData) {
    return <StatePanel message="Insufficient data for valuation" />;
  }

  const currentTradingMultiple = toNumber(modeData.current_trading_multiple);
  const currentMetricLabel = modeData.current_metric_label || 'Current Metric';
  const terminalLabel = modeKey === 'cashFlow'
    ? 'Appropriate FCF Multiple'
    : 'Appropriate EPS Multiple';
  const projectionMessage = modeData.available
    ? 'Adjust the current metric and assumptions to see the five-year projection.'
    : (modeData.availability_reason || 'Insufficient data for valuation');

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h3 className="font-display text-2xl font-semibold text-text-primary">Assumptions</h3>
        </div>

        <div className="flex flex-col gap-6 p-6">
          <div className="flex gap-2">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setModeKey(option.key)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition cursor-pointer ${
                  modeKey === option.key
                    ? 'border-accent bg-accent text-text-inverse'
                    : 'border-border text-text-secondary hover:bg-elevated'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 rounded-xl border border-border bg-elevated p-4 sm:grid-cols-3">
            <div>
              <div className="font-body text-xs uppercase tracking-wide text-text-tertiary">
                {currentMetricLabel}
              </div>
              <div className="font-data text-2xl text-text-primary">
                {formatCompact(modeData.current_metric_value)}
              </div>
            </div>
            <div>
              <div className="font-body text-xs uppercase tracking-wide text-text-tertiary">
                Current Multiple
              </div>
              <div className="font-data text-2xl text-text-primary">
                {formatCompact(currentTradingMultiple)}
              </div>
            </div>
            <div>
              <div className="font-body text-xs uppercase tracking-wide text-text-tertiary">
                Suggested Growth
              </div>
              <div className="font-data text-2xl text-text-primary">
                {formatPercent(modeData.growth_rate_default).replace('+', '')}
              </div>
            </div>
          </div>

          {modeData.available ? (
            <div className="flex flex-col gap-5">
              <AssumptionField
                label={`${currentMetricLabel} (editable)`}
                helper="Use the prefilled value as a starting point, or replace it with your own thesis."
                value={currentMetric}
                onChange={(value) => updateModeDraft('currentMetric', value)}
              />
              <AssumptionField
                label="Growth Rate"
                suffix="%"
                helper="Prefilled from recent company data and bounded to a sober five-year starting assumption."
                value={growthRate}
                onChange={(value) => updateModeDraft('growthRate', value)}
              />
              <AssumptionField
                label={terminalLabel}
                helper="The multiple you believe the market should pay in year five."
                value={terminalMultiple}
                onChange={(value) => updateModeDraft('terminalMultiple', value)}
              />
              <AssumptionField
                label="Desired Return"
                suffix="%"
                helper="Used to compute the entry price that would justify your target return."
                value={desiredReturn}
                onChange={(value) => updateModeDraft('desiredReturn', value)}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-elevated px-4 py-5 text-sm text-text-secondary">
              {modeData.availability_reason || 'Insufficient data for valuation'}
            </div>
          )}

          <WarningList warnings={data?.warnings} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h3 className="font-display text-2xl font-semibold text-text-primary">5-Year Projection</h3>
        </div>

        <div className="flex flex-col gap-6 p-6">
          <div className="grid gap-3 rounded-xl border border-border bg-elevated p-4 md:grid-cols-3">
            <div>
              <div className="font-body text-xs uppercase tracking-wide text-text-tertiary">
                Implied Year 5 Price
              </div>
              <div className="font-data text-2xl text-text-primary">{formatCurrency(futurePrice)}</div>
            </div>
            <div>
              <div className="font-body text-xs uppercase tracking-wide text-text-tertiary">
                Implied CAGR vs Today
              </div>
              <div className="font-data text-2xl text-text-primary">{formatPercent(annualizedReturn)}</div>
              <div className="pt-1 font-body text-xs text-text-tertiary">
                {`Total ${projectionYears}-year return: ${formatPercent(totalReturn)}`}
              </div>
            </div>
            <div>
              <div className="font-body text-xs uppercase tracking-wide text-text-tertiary">
                Entry Price For {desiredReturnValue == null ? '—' : formatPercentWithoutSign(desiredReturnValue)} CAGR
              </div>
              <div className="font-data text-2xl text-text-primary">{formatCurrency(entryPrice)}</div>
            </div>
          </div>

          {projectionData.length > 0 ? (
            <ProjectionChart data={projectionData} />
          ) : (
            <StatePanel message={projectionMessage} />
          )}
        </div>
      </section>
    </div>
  );
}

export default ValuationTab;
