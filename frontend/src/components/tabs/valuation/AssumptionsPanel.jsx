import React from 'react';
import {
  StockDetailMetricCard,
  StockDetailMetricGrid,
  StockDetailSection,
} from '../../stock-detail/StockDetailPrimitives';
import {
  formatCompact,
  formatUnsignedPercent,
} from './valuationModel';

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

export function AssumptionsPanel({
  currentMetricLabel,
  currentTradingMultiple,
  modeData,
  currentMetric,
  growthRate,
  terminalMultiple,
  desiredReturn,
  terminalLabel,
  onFieldChange,
  className = '',
}) {
  return (
    <StockDetailSection
      className={className}
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
            onChange={(value) => onFieldChange('currentMetric', value)}
          />
          <AssumptionField
            label="Growth Rate"
            suffix="%"
            helper="Prefilled from recent company data and bounded to a sober five-year starting assumption."
            value={growthRate}
            onChange={(value) => onFieldChange('growthRate', value)}
          />
          <AssumptionField
            label={terminalLabel}
            helper="The multiple you believe the market should pay in year five."
            value={terminalMultiple}
            onChange={(value) => onFieldChange('terminalMultiple', value)}
          />
          <AssumptionField
            label="Desired Return"
            suffix="%"
            helper="Used to compute the entry price that would justify your target return."
            value={desiredReturn}
            onChange={(value) => onFieldChange('desiredReturn', value)}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-elevated px-4 py-5 text-sm text-text-secondary">
          {modeData.availability_reason || 'Insufficient data for valuation'}
        </div>
      )}
    </StockDetailSection>
  );
}
