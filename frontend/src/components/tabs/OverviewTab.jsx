import React from 'react';

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

function formatShareCount(n) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(abs / 1e3).toFixed(1)}K`;
  return abs.toLocaleString();
}

function formatPercent(n) {
  if (n == null || isNaN(n)) return '—';
  return `${(Number(n) * 100).toFixed(2)}%`;
}

function OverviewTab({ ticker, company }) {
  const data = company || {};

  const stats = [
    {
      label: 'Market Cap',
      value: formatLargeNumber(data.market_cap),
    },
    {
      label: 'P/E Ratio',
      value: data.pe_ratio != null && !isNaN(data.pe_ratio)
        ? Number(data.pe_ratio).toFixed(2)
        : '—',
    },
    {
      label: 'Latest Revenue',
      value: formatLargeNumber(data.latest_revenue),
    },
    {
      label: 'Revenue Growth',
      value: formatPercent(data.revenue_growth_yoy),
    },
    {
      label: 'Net Margin',
      value: formatPercent(data.net_margin),
    },
    {
      label: 'Free Cash Flow',
      value: formatLargeNumber(data.free_cash_flow),
    },
    {
      label: 'Dividend Yield',
      value: formatPercent(data.dividend_yield),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* ---- Key Stats Grid ---- */}
      <section>
        <h3 className="font-display text-lg font-bold text-text-primary mb-4">Key Stats</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
              <span className="font-body text-sm font-medium text-text-secondary tracking-tight">{stat.label}</span>
              <span className="font-data text-xl font-semibold text-text-primary leading-tight">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Company Description ---- */}
      <section>
        <h3 className="font-display text-lg font-bold text-text-primary mb-4">About {data.name || ticker}</h3>
        <div className="bg-surface border border-border rounded-lg p-6 mt-6">
          <p className="font-body text-base text-text-secondary leading-relaxed">
            {data.description || `Company description is not available yet for ${data.ticker || ticker}.`}
          </p>
        </div>
      </section>

      <section>
        <h3 className="font-display text-lg font-bold text-text-primary mb-4">Business Context</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
            <span className="font-body text-sm font-medium text-text-secondary">Sector / Industry</span>
            <span className="font-body text-base font-medium text-text-primary leading-snug">
              {[data.sector, data.industry].filter(Boolean).join(' / ') || '—'}
            </span>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
            <span className="font-body text-sm font-medium text-text-secondary">Shares Outstanding</span>
            <span className="font-data text-xl font-semibold text-text-primary leading-tight">
              {formatShareCount(data.shares_outstanding)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default OverviewTab;
