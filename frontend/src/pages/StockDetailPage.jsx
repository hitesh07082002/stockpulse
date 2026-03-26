import React, { Suspense, lazy, startTransition, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCompany } from '../hooks/useStockData';
import OverviewTab from '../components/tabs/OverviewTab';
import {
  StockDetailChartStage,
  StockDetailMetricGrid,
  StockDetailSection,
} from '../components/stock-detail/StockDetailPrimitives';

const FinancialsTab = lazy(() => import('../components/tabs/FinancialsTab'));
const PriceTab = lazy(() => import('../components/tabs/PriceTab'));
const ValuationTab = lazy(() => import('../components/tabs/ValuationTab'));
const AITab = lazy(() => import('../components/tabs/AITab'));

const TABS = [
  { key: 'overview', label: 'Overview', mobileLabel: 'Overview', Component: OverviewTab },
  { key: 'financials', label: 'Financials', mobileLabel: 'Financials', Component: FinancialsTab },
  { key: 'price', label: 'Price', mobileLabel: 'Price', Component: PriceTab },
  { key: 'valuation', label: 'DCF Calculator', mobileLabel: 'DCF', Component: ValuationTab },
  { key: 'ai', label: 'AI', mobileLabel: 'AI', Component: AITab },
];

function TabPanelFallback({ tabKey }) {
  const showCardGrid = tabKey === 'financials' || tabKey === 'valuation';
  const showChart = tabKey === 'financials' || tabKey === 'price' || tabKey === 'valuation';
  const chartPreset = tabKey === 'price' ? 'price' : 'projection';

  return (
    <div className="flex flex-col gap-6">
      <StockDetailSection bodyClassName="gap-4">
        <div className="skeleton h-7 w-40 rounded" />
        <div className="skeleton h-4 w-72 max-w-full rounded" />
        {showCardGrid ? (
          <StockDetailMetricGrid className={tabKey === 'valuation' ? 'xl:grid-cols-3' : ''}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-8 w-28 rounded" />
                <div className="skeleton h-3 w-20 rounded" />
              </div>
            ))}
          </StockDetailMetricGrid>
        ) : null}
        {showChart ? (
          <StockDetailChartStage preset={chartPreset} className="bg-base/20">
            <div className="h-full w-full skeleton" />
          </StockDetailChartStage>
        ) : (
          <div className="skeleton h-40 w-full rounded-xl" />
        )}
      </StockDetailSection>
    </div>
  );
}

function formatMarketCap(value) {
  if (value == null) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

function formatPrice(value) {
  if (value == null) return '--';
  return Number(value).toFixed(2);
}

function formatChange(value) {
  if (value == null) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

function formatQuoteTimestamp(value) {
  if (!value) return null;

  const updatedAt = new Date(value);
  if (Number.isNaN(updatedAt.getTime())) return null;

  return updatedAt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StockDetailPage() {
  const { ticker } = useParams();
  const { data: company, isLoading, isError, error } = useCompany(ticker);
  const [activeTab, setActiveTab] = useState('overview');
  const normalizedTicker = ticker?.toUpperCase();
  const isNotFound = (!isLoading && !isError && !company) || (isError && error?.status === 404);

  // Treat an empty result or backend 404 as the same search-facing not-found state.
  if (isNotFound) {
    return (
      <div className="flex flex-col min-h-[var(--shell-content-min-height)]">
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <span className="font-data text-4xl font-bold text-text-tertiary">
            404
          </span>
          <p className="font-body text-lg text-text-secondary">
            Company not found for ticker <strong>{normalizedTicker}</strong>
          </p>
          <Link
            to="/"
            className="font-body text-sm text-accent hover:text-accent-hover transition-colors"
          >
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  // Network / server error
  if (isError) {
    return (
      <div className="flex flex-col min-h-[var(--shell-content-min-height)]">
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="font-body text-base text-red-500">
            {error?.message || 'Something went wrong. Please try again.'}
          </p>
          <Link
            to="/"
            className="font-body text-sm text-accent hover:text-accent-hover transition-colors"
          >
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const changeValue = company?.change_percent ?? company?.changePercent;
  const isPositive = changeValue != null && Number(changeValue) >= 0;
  const quoteFreshnessLabel = formatQuoteTimestamp(company?.quote_updated_at);

  const ActiveComponent = TABS.find((t) => t.key === activeTab)?.Component;

  return (
    <div className="flex min-h-[var(--shell-content-min-height)] w-full flex-col gap-6">
      {/* ---- Persistent Company Header ---- */}
      <div className="sticky top-[var(--shell-header-height)] z-40 border-b border-border bg-base/95 pb-4 backdrop-blur-md">
        {isLoading ? (
          <div className="flex flex-col gap-3 pb-4">
            <div className="skeleton h-8 w-48 rounded" />
            <div className="skeleton h-6 w-80 rounded" />
            <div className="skeleton h-4 w-44 rounded" />
          </div>
        ) : (
          <>
            {/* Ticker + Price + Change */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-display text-3xl font-bold text-text-primary leading-none tracking-tight">
                {company.ticker}
              </span>
              {company.current_price != null && (
                <span className="font-data text-2xl font-bold text-text-primary leading-none">
                  ${formatPrice(company.current_price)}
                </span>
              )}
              {changeValue != null && (
                <span
                  className={`font-data text-lg font-medium leading-none ${
                    isPositive ? 'text-up' : 'text-down'
                  }`}
                >
                  {formatChange(changeValue)}
                </span>
              )}
            </div>

            {/* Company meta */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
              {company.name && (
                <span className="font-body text-base font-medium text-text-secondary">
                  {company.name}
                </span>
              )}
              {company.sector && (
                <>
                  <span className="text-text-tertiary select-none">/</span>
                  <span className="font-body text-sm text-text-tertiary">
                    {company.sector}
                  </span>
                </>
              )}
              {company.industry && (
                <>
                  <span className="text-text-tertiary select-none">/</span>
                  <span className="font-body text-sm text-text-tertiary">
                    {company.industry}
                  </span>
                </>
              )}
              {company.market_cap != null && (
                <span className="font-data text-sm text-text-secondary bg-elevated px-2 py-0.5 rounded-full">
                  {formatMarketCap(company.market_cap)}
                </span>
              )}
              {quoteFreshnessLabel && (
                <span className="font-body text-xs px-2 py-0.5 rounded-full bg-elevated text-text-tertiary">
                  {`Quote updated ${quoteFreshnessLabel}`}
                </span>
              )}
            </div>
          </>
        )}

        {/* ---- Tab Bar ---- */}
        <div className="relative mt-3">
          <ul
            className="flex gap-0 border-b border-border overflow-x-auto pr-8 scrollbar-none snap-x snap-mandatory"
            role="tablist"
          >
            {TABS.map(({ key, label, mobileLabel }) => (
              <li key={key} className="shrink-0" role="presentation">
                <button
                  role="tab"
                  aria-selected={activeTab === key}
                  aria-label={label}
                  className={`min-h-11 snap-start px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer sm:px-4 ${
                    activeTab === key
                      ? 'text-accent border-accent'
                      : 'text-text-secondary hover:text-text-primary border-transparent'
                  }`}
                  onClick={() => {
                    startTransition(() => setActiveTab(key));
                  }}
                >
                  <span className="sm:hidden">{mobileLabel || label}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-base to-transparent sm:hidden" />
        </div>
      </div>

      {/* ---- Tab Content ---- */}
      <div className="flex-1 pt-1 sm:pt-2" role="tabpanel">
        {ActiveComponent && (
          <Suspense fallback={<TabPanelFallback tabKey={activeTab} />}>
            <ActiveComponent ticker={ticker} company={company} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default StockDetailPage;
