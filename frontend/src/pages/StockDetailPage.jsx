import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCompany } from '../hooks/useStockData';
import OverviewTab from '../components/tabs/OverviewTab';
import FinancialsTab from '../components/tabs/FinancialsTab';
import PriceTab from '../components/tabs/PriceTab';
import ValuationTab from '../components/tabs/ValuationTab';
import AITab from '../components/tabs/AITab';

const TABS = [
  { key: 'overview', label: 'Overview', Component: OverviewTab },
  { key: 'financials', label: 'Financials', Component: FinancialsTab },
  { key: 'price', label: 'Price', Component: PriceTab },
  { key: 'valuation', label: 'Valuation', Component: ValuationTab },
  { key: 'ai', label: 'AI', Component: AITab },
];

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
            to="/screener"
            className="font-body text-sm text-accent hover:text-accent-hover transition-colors"
          >
            Search for another company
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
            to="/screener"
            className="font-body text-sm text-accent hover:text-accent-hover transition-colors"
          >
            Back to screener
          </Link>
        </div>
      </div>
    );
  }

  const changeValue = company?.change_percent ?? company?.changePercent;
  const isPositive = changeValue != null && Number(changeValue) >= 0;

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
              {company.price != null && (
                <span className="font-data text-2xl font-bold text-text-primary leading-none">
                  ${formatPrice(company.price)}
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
            </div>
          </>
        )}

        {/* ---- Tab Bar ---- */}
        <ul
          className="flex gap-0 border-b border-border overflow-x-auto mt-3 scrollbar-none"
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
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ---- Tab Content ---- */}
      <div className="py-6 flex-1" role="tabpanel">
        {ActiveComponent && (
          <ActiveComponent ticker={ticker} company={company} />
        )}
      </div>
    </div>
  );
}

export default StockDetailPage;
