import React from 'react';

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 flex flex-col gap-10">
      {/* ---- Heading ---- */}
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold text-text-primary tracking-tight">
          About StockPulse
        </h1>
        <p className="font-body text-base text-text-secondary leading-relaxed">
          An AI-powered stock analysis platform that combines 30 years of SEC
          financial data with modern AI to help retail investors make informed
          decisions. Built with Django, React, and PostgreSQL.
        </p>
      </header>

      {/* ---- Data Sources ---- */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold text-text-primary">
          Data Sources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-2">
            <span className="font-body text-sm font-medium text-accent">
              SEC EDGAR
            </span>
            <p className="font-body text-xs text-text-secondary leading-relaxed">
              Free, public-domain financial filings. 30 years of 10-K and 10-Q
              data for every S&P 500 company.
            </p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-2">
            <span className="font-body text-sm font-medium text-accent">
              yfinance
            </span>
            <p className="font-body text-xs text-text-secondary leading-relaxed">
              Free market data library. Real-time prices, historical quotes,
              and company metadata.
            </p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-2">
            <span className="font-body text-sm font-medium text-accent">
              Claude API
            </span>
            <p className="font-body text-xs text-text-secondary leading-relaxed">
              AI-powered analysis and chat. Natural language insights into
              financial performance and valuation.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Architecture ---- */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold text-text-primary">
          Architecture
        </h2>
        <div className="bg-surface border border-border rounded-lg p-6 overflow-x-auto">
          <pre className="font-data text-xs text-text-secondary leading-relaxed whitespace-pre">
{`  Browser (React + Tailwind)
         |
         | REST / SSE
         v
  Django API Server
    |           |
    v           v
PostgreSQL   Claude API
    ^
    |
SEC EDGAR + yfinance
  (data pipeline)`}
          </pre>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-2">
            <span className="font-body text-sm font-medium text-text-primary">
              Frontend
            </span>
            <p className="font-body text-xs text-text-secondary leading-relaxed">
              React 18, React Router, TanStack Query, Tailwind CSS v4,
              Recharts for data visualization.
            </p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-2">
            <span className="font-body text-sm font-medium text-text-primary">
              Backend
            </span>
            <p className="font-body text-xs text-text-secondary leading-relaxed">
              Django REST Framework, PostgreSQL, SEC EDGAR data pipeline,
              streaming AI chat via Server-Sent Events.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Built by ---- */}
      <footer className="border-t border-border pt-6">
        <p className="font-body text-sm text-text-secondary">
          Built by{' '}
          <a
            href="https://github.com/hiteshsadhwani"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Hitesh Sadhwani
          </a>
        </p>
      </footer>
    </div>
  );
}
