import React, { Suspense, lazy, startTransition, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCompany } from '../hooks/useStockData';
import OverviewTab from '../components/tabs/OverviewTab';

const FinancialsTab = lazy(() => import('../components/tabs/FinancialsTab'));
const PriceTab = lazy(() => import('../components/tabs/PriceTab'));
const ValuationTab = lazy(() => import('../components/tabs/ValuationTab'));
const AITab = lazy(() => import('../components/tabs/AITab'));

const TABS = [
  { key: 'overview', label: 'Overview', Component: OverviewTab },
  { key: 'financials', label: 'Financials', Component: FinancialsTab },
  { key: 'price', label: 'Price', Component: PriceTab },
  { key: 'valuation', label: 'Valuation', Component: ValuationTab },
  { key: 'ai', label: 'AI', Component: AITab },
];

function TabPanelFallback({ tabKey }) {
  const showCardGrid = tabKey === 'financials' || tabKey === 'valuation';
  const showChart = tabKey === 'financials' || tabKey === 'price' || tabKey === 'valuation';

  return (
    <div className="flex flex-col gap-4">
      {showCardGrid && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-7 w-32 rounded" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
          ))}
        </div>
      )}
      {showChart && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="skeleton h-[360px] w-full rounded-lg" />
        </div>
      )}
      {!showCardGrid && !showChart && (
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="skeleton h-6 w-40 rounded" />
          <div className="mt-4 skeleton h-40 w-full rounded-lg" />
        </div>
      )}
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

  // 404: company not found (API returned but no data)
  if (!isLoading && !isError && !company) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-56px-80px)]">
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <span className="font-data text-4xl font-bold text-text-tertiary">
            404
          </span>
          <p className="font-body text-lg text-text-secondary">
            Company not found for ticker <strong>{ticker?.toUpperCase()}</strong>
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
      <div className="flex flex-col min-h-[calc(100vh-56px-80px)]">
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
    <div className="flex flex-col min-h-[calc(100vh-56px-80px)]">
      {/* ---- Persistent Company Header ---- */}
      <div className="sticky top-14 z-40 bg-base border-b border-border px-4 py-4">
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
            className="flex gap-0 border-b border-border overflow-x-auto pr-8 scrollbar-none"
            role="tablist"
          >
            {TABS.map(({ key, label }) => (
              <li key={key} className="shrink-0" role="presentation">
                <button
                  role="tab"
                  aria-selected={activeTab === key}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === key
                      ? 'text-accent border-accent'
                      : 'text-text-secondary hover:text-text-primary border-transparent'
                  }`}
                  onClick={() => {
                    startTransition(() => setActiveTab(key));
                  }}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-base to-transparent sm:hidden" />
        </div>
      </div>

      {/* ---- Tab Content ---- */}
      <div className="py-6 flex-1" role="tabpanel">
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
