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
import {
  StockDetailChartStage,
  StockDetailMetricCard,
  StockDetailMetricGrid,
  StockDetailSection,
  StockDetailStatePanel,
} from '../stock-detail/StockDetailPrimitives';

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

function formatUnsignedPercent(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.abs(value).toFixed(2)}%`;
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

function ProjectionTooltip({ active, payload, metricLabel }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const resolvedMetricLabel = metricLabel || 'Metric';

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-elevated p-3 shadow-lg">
      <span className="font-body text-xs text-text-tertiary">{point.label}</span>
      <span className="font-data text-sm font-medium text-text-primary">
        {formatCurrency(point.projectedPrice)}
      </span>
      <span className="font-data text-xs text-text-secondary">
        {`Projected ${resolvedMetricLabel}: ${formatCompact(point.projectedMetric)}`}
      </span>
    </div>
  );
}

function ProjectionChart({ data, metricLabel }) {
  const hostRef = useRef(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const isCompact = chartSize.width > 0 && chartSize.width < 520;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const updateSize = () => {
      setChartSize({
        width: host.clientWidth || 0,
        height: host.clientHeight || 0,
      });
    };

    updateSize();

    let observer = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(() => updateSize());
      observer.observe(host);
    } else {
      window.addEventListener('resize', updateSize);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', updateSize);
      }
    };
  }, []);

  return (
    <StockDetailChartStage preset="projection" className="border border-border bg-base/20">
      <div ref={hostRef} className="h-full w-full">
        {chartSize.width > 0 && chartSize.height > 0 ? (
          <LineChart
            width={chartSize.width}
            height={chartSize.height}
            data={data}
            margin={isCompact
              ? { top: 8, right: 10, left: -20, bottom: 0 }
              : { top: 10, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: isCompact ? 11 : 12 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={isCompact ? 12 : 24}
            />
            <YAxis
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: isCompact ? 11 : 12 }}
              axisLine={false}
              tickLine={false}
              width={isCompact ? 52 : 72}
            />
            <Tooltip content={<ProjectionTooltip metricLabel={metricLabel} />} />
            <Line
              type="monotone"
              dataKey="projectedPrice"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              dot={{ r: isCompact ? 3 : 4, fill: 'var(--color-accent)' }}
              activeDot={{ r: isCompact ? 5 : 6 }}
            />
          </LineChart>
        ) : null}
      </div>
    </StockDetailChartStage>
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
        className="min-h-11 w-full rounded-lg border border-border bg-elevated px-3 py-2 font-data text-base text-text-primary outline-none transition focus:border-accent"
      />
      {helper ? <span className="font-body text-xs text-text-tertiary">{helper}</span> : null}
    </label>
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

function ModeToggle({ modeKey, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-2 rounded-full border border-border bg-elevated p-1">
      {MODE_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium transition cursor-pointer ${
            modeKey === option.key
              ? 'bg-accent text-text-inverse'
              : 'text-text-secondary hover:bg-surface hover:text-text-primary'
          }`}
        >
          {option.label}
        </button>
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
      <div className="flex flex-col gap-6">
        <StockDetailSection bodyClassName="gap-4">
          <div className="skeleton h-8 w-52 rounded" />
          <div className="skeleton h-5 w-72 max-w-full rounded" />
          <StockDetailMetricGrid className="xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <div className="skeleton h-3 w-28 rounded" />
                <div className="skeleton h-9 w-36 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
              </div>
            ))}
          </StockDetailMetricGrid>
          <div className="skeleton h-16 w-full rounded-xl" />
        </StockDetailSection>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <StockDetailSection bodyClassName="gap-4">
            <div className="skeleton h-7 w-36 rounded" />
            <div className="skeleton h-4 w-72 max-w-full rounded" />
            <StockDetailMetricGrid className="xl:grid-cols-1">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton h-8 w-28 rounded" />
                </div>
              ))}
            </StockDetailMetricGrid>
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <div className="skeleton h-4 w-36 rounded" />
                <div className="skeleton min-h-11 h-11 w-full rounded-lg" />
                <div className="skeleton h-3 w-64 max-w-full rounded" />
              </div>
            ))}
          </StockDetailSection>
          <StockDetailSection bodyClassName="gap-4">
            <div className="skeleton h-7 w-48 rounded" />
            <div className="skeleton h-4 w-80 max-w-full rounded" />
            <StockDetailChartStage preset="projection" className="bg-base/20">
              <div className="h-full w-full skeleton" />
            </StockDetailChartStage>
          </StockDetailSection>
        </div>
      </div>
    );
  }

  if (error) {
    return <StockDetailStatePanel tone="error" message="Valuation inputs unavailable" />;
  }

  if (data?.not_applicable) {
    return (
      <div className="flex flex-col gap-6">
        <StockDetailSection
          title="DCF Calculator"
          subtitle="Assumption-driven valuation workspace with guardrails for incomplete or rough-fit cases."
        >
          <WarningList warnings={data?.warnings} />
        </StockDetailSection>
        <StockDetailStatePanel
          message={data?.not_applicable_reason || 'Valuation unavailable for this company'}
        />
      </div>
    );
  }

  if (!modeData) {
    return <StockDetailStatePanel message="Insufficient data for valuation" />;
  }

  const currentTradingMultiple = toNumber(modeData.current_trading_multiple);
  const currentMetricLabel = modeData.current_metric_label || 'Current Metric';
  const terminalLabel = modeKey === 'cashFlow'
    ? 'Appropriate FCF Multiple'
    : 'Appropriate EPS Multiple';
  const visibleWarnings = [...(data?.warnings || []), ...(modeData?.warnings || [])];
  const projectionMessage = modeData.available
    ? 'Adjust the current metric and assumptions to see the five-year projection.'
    : (modeData.availability_reason || 'Insufficient data for valuation');

  return (
    <div className="flex flex-col gap-6">
      <StockDetailSection
        title="DCF Calculator"
        subtitle="A compact, assumption-driven five-year valuation workspace."
        actions={<ModeToggle modeKey={modeKey} onChange={setModeKey} />}
      >
        <StockDetailMetricGrid className="grid-cols-2 xl:grid-cols-3">
          <StockDetailMetricCard
            label="Implied Year 5 Price"
            value={formatCurrency(futurePrice)}
          />
          <StockDetailMetricCard
            label="Implied CAGR vs Today"
            value={formatPercent(annualizedReturn)}
            supporting={`Total ${projectionYears}-year return: ${formatPercent(totalReturn)}`}
          />
          <StockDetailMetricCard
            label={`Entry Price For ${desiredReturnValue == null ? '—' : formatPercentWithoutSign(desiredReturnValue)} CAGR`}
            value={formatCurrency(entryPrice)}
            className="sm:col-span-2 xl:col-span-1"
          />
        </StockDetailMetricGrid>

        <WarningList warnings={visibleWarnings} />
      </StockDetailSection>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:items-start">
        <StockDetailSection
          className="order-2 xl:order-1"
          title="Assumptions"
          subtitle="Use the current company data as a sober starting point, then adjust to match your thesis."
        >
          <StockDetailMetricGrid className="xl:grid-cols-1">
            <StockDetailMetricCard
              label={currentMetricLabel}
              value={formatCompact(modeData.current_metric_value)}
            />
            <StockDetailMetricCard
              label="Current Multiple"
              value={formatCompact(currentTradingMultiple)}
            />
            <StockDetailMetricCard
              label="Suggested Growth"
              value={formatUnsignedPercent(modeData.growth_rate_default)}
              className="sm:col-span-2 xl:col-span-1"
            />
          </StockDetailMetricGrid>

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
        </StockDetailSection>

        <StockDetailSection
          className="order-1 xl:order-2"
          title="5-Year Projection"
          subtitle={projectionMessage}
        >
          {projectionData.length > 0 ? (
            <ProjectionChart data={projectionData} metricLabel={currentMetricLabel} />
          ) : (
            <StockDetailStatePanel message={projectionMessage} height="projection" />
          )}
        </StockDetailSection>
      </div>
    </div>
  );
}

export default ValuationTab;
