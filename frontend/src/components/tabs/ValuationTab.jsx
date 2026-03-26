import React, { useMemo, useState } from 'react';
import { useValuationInputs } from '../../hooks/useStockData';
import {
  StockDetailChartStage,
  StockDetailMetricGrid,
  StockDetailSection,
  StockDetailStatePanel,
} from '../stock-detail/StockDetailPrimitives';
import { ResponsiveSplitPanel } from '../stock-detail/StockDetailWorkspace';
import { AssumptionsPanel } from './valuation/AssumptionsPanel';
import { ProjectionPanel } from './valuation/ProjectionPanel';
import { buildValuationViewModel } from './valuation/valuationModel';
import { ValuationSummary, WarningList } from './valuation/ValuationSummary';

const MODE_OPTIONS = [
  { key: 'earnings', label: 'Earnings' },
  { key: 'cashFlow', label: 'Cash Flow' },
];

function ModeToggle({ modeKey, onChange }) {
  return (
    <div
      role="group"
      aria-label="Valuation mode"
      className="inline-flex flex-wrap gap-2 rounded-full border border-border bg-elevated p-1"
    >
      {MODE_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={modeKey === option.key}
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

function ValuationLoadingState() {
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

      <ResponsiveSplitPanel
        secondaryFirstOnMobile
        primary={(
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
        )}
        secondary={(
          <StockDetailSection bodyClassName="gap-4">
            <div className="skeleton h-7 w-48 rounded" />
            <div className="skeleton h-4 w-80 max-w-full rounded" />
            <StockDetailChartStage preset="projection" className="bg-base/20">
              <div className="h-full w-full skeleton" />
            </StockDetailChartStage>
          </StockDetailSection>
        )}
      />
    </div>
  );
}

function ValuationTab({ ticker }) {
  const { data, isLoading, error } = useValuationInputs(ticker);
  const [modeKey, setModeKey] = useState('earnings');
  const [draftByMode, setDraftByMode] = useState({});

  function updateModeDraft(field, value) {
    setDraftByMode((current) => ({
      ...current,
      [modeKey]: {
        ...(current[modeKey] || {}),
        [field]: value,
      },
    }));
  }

  const viewModel = useMemo(
    () => buildValuationViewModel({
      data,
      modeKey,
      modeDraft: draftByMode[modeKey] || {},
    }),
    [data, draftByMode, modeKey],
  );

  if (isLoading) {
    return <ValuationLoadingState />;
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

  if (!viewModel.modeData) {
    return <StockDetailStatePanel message="Insufficient data for valuation" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <StockDetailSection
        title="DCF Calculator"
        subtitle="A compact, assumption-driven five-year valuation workspace."
        actions={<ModeToggle modeKey={modeKey} onChange={setModeKey} />}
      >
        <ValuationSummary
          futurePrice={viewModel.futurePrice}
          annualizedReturn={viewModel.annualizedReturn}
          projectionYears={viewModel.projectionYears}
          totalReturn={viewModel.totalReturn}
          desiredReturnValue={viewModel.desiredReturnValue}
          entryPrice={viewModel.entryPrice}
          warnings={viewModel.visibleWarnings}
        />
      </StockDetailSection>

      <ResponsiveSplitPanel
        secondaryFirstOnMobile
        primary={(
          <AssumptionsPanel
            currentMetricLabel={viewModel.currentMetricLabel}
            currentTradingMultiple={viewModel.currentTradingMultiple}
            modeData={viewModel.modeData}
            currentMetric={viewModel.currentMetric}
            growthRate={viewModel.growthRate}
            terminalMultiple={viewModel.terminalMultiple}
            desiredReturn={viewModel.desiredReturn}
            terminalLabel={viewModel.terminalLabel}
            onFieldChange={updateModeDraft}
          />
        )}
        secondary={(
          <ProjectionPanel
            projectionMessage={viewModel.projectionMessage}
            projectionData={viewModel.projectionData}
            currentMetricLabel={viewModel.currentMetricLabel}
          />
        )}
      />
    </div>
  );
}

export default ValuationTab;
