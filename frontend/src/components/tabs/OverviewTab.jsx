import React from 'react';

/* ────────────────────────────────────────────
   Format helpers
   ──────────────────────────────────────────── */

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

/* ────────────────────────────────────────────
   52-Week Range Bar
   ──────────────────────────────────────────── */

function RangeBar({ low, high, current }) {
  const hasData = low != null && high != null && current != null && high !== low;
  const pct = hasData
    ? Math.min(Math.max(((current - low) / (high - low)) * 100, 0), 100)
    : null;

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between items-center">
        <span className="font-data text-sm font-medium text-text-primary">
          {low != null ? `$${Number(low).toFixed(2)}` : '—'}
        </span>
        <span className="font-data text-sm font-medium text-text-primary">
          {high != null ? `$${Number(high).toFixed(2)}` : '—'}
        </span>
      </div>
      <div className="relative w-full h-1 bg-elevated rounded-full">
        {pct != null && (
          <div
            className="absolute top-1/2 w-3 h-3 bg-accent rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_3px_var(--color-accent-muted)] transition-[left] duration-300"
            style={{ left: `${pct}%` }}
            title={`Current: $${Number(current).toFixed(2)}`}
          />
        )}
      </div>
      <div className="flex justify-between items-center">
        <span className="font-body text-xs text-text-tertiary">Low</span>
        <span className="font-body text-xs text-text-tertiary">High</span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   OverviewTab
   ──────────────────────────────────────────── */

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
      label: '52-Week Range',
      custom: (
        <RangeBar
          low={data.week_52_low}
          high={data.week_52_high}
          current={data.current_price}
        />
      ),
    },
    {
      label: 'Dividend Yield',
      value: formatPercent(data.dividend_yield),
    },
    {
      label: 'Shares Outstanding',
      value: formatShareCount(data.shares_outstanding),
    },
    {
      label: 'Sector / Industry',
      value: [data.sector, data.industry].filter(Boolean).join(' / ') || '—',
      isText: true,
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
              {stat.custom ? (
                stat.custom
              ) : (
                <span
                  className={
                    stat.isText
                      ? 'font-body text-base font-medium text-text-primary leading-snug'
                      : 'font-data text-xl font-semibold text-text-primary leading-tight'
                  }
                >
                  {stat.value}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---- Company Description ---- */}
      <section>
        <h3 className="font-display text-lg font-bold text-text-primary mb-4">About {data.name || ticker}</h3>
        <div className="bg-surface border border-border rounded-lg p-6 mt-6">
          <p className="font-body text-base text-text-secondary leading-relaxed">
            {data.description || 'No company description available.'}
          </p>
        </div>
      </section>
    </div>
  );
}

export default OverviewTab;
