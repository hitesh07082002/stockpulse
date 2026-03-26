import React from 'react';
import {
  StockDetailMetricCard,
  StockDetailMetricGrid,
} from '../../stock-detail/StockDetailPrimitives';
import {
  formatCurrency,
  formatPercent,
  formatPercentWithoutSign,
} from './valuationModel';

export function WarningList({ warnings }) {
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

export function ValuationSummary({
  futurePrice,
  annualizedReturn,
  projectionYears,
  totalReturn,
  desiredReturnValue,
  entryPrice,
  warnings,
}) {
  return (
    <>
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

      <WarningList warnings={warnings} />
    </>
  );
}
