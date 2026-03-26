import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  StockDetailChartStage,
  StockDetailSection,
  StockDetailStatePanel,
} from '../../stock-detail/StockDetailPrimitives';
import { useChartHostSize } from '../../stock-detail/useChartHostSize';
import {
  formatCompact,
  formatCurrency,
} from './valuationModel';

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
  const { hostRef, chartSize, isCompact } = useChartHostSize();

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

export function ProjectionPanel({
  projectionMessage,
  projectionData,
  currentMetricLabel,
  className = '',
}) {
  return (
    <StockDetailSection
      className={className}
      title="5-Year Projection"
      subtitle={projectionMessage}
    >
      {projectionData.length > 0 ? (
        <ProjectionChart data={projectionData} metricLabel={currentMetricLabel} />
      ) : (
        <StockDetailStatePanel message={projectionMessage} height="projection" />
      )}
    </StockDetailSection>
  );
}
