import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCompanySearch } from '../hooks/useStockData';

/* ------------------------------------------------------------------ */
/*  Trust cues                                                         */
/* ------------------------------------------------------------------ */
const RESEARCH_HIGHLIGHTS = [
  {
    eyebrow: 'Coverage',
    title: '500-company research scope',
    body: 'Search the S&P 500 universe with a company set normalized by unique SEC CIK.',
  },
  {
    eyebrow: 'Data',
    title: 'Canonical SEC financials',
    body: 'Annual and quarterly history is selected, derived, and audited from SEC filings before it reaches the UI.',
  },
  {
    eyebrow: 'Workflow',
    title: 'One dataset across every surface',
    body: 'Financials, valuation, screener, and AI all read from the same structured StockPulse data model.',
  },
];

const QUICK_TICKERS = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'JPM'];

/* ------------------------------------------------------------------ */
/*  SearchBar Component                                                */
/* ------------------------------------------------------------------ */
function SearchBar() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Debounce the search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useCompanySearch(debouncedQuery);
  const results = data?.results ?? data ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (ticker) => {
      setQuery('');
      setIsOpen(false);
      navigate(`/stock/${ticker}`);
    },
    [navigate],
  );

  const handleQuickClick = useCallback(
    (ticker) => {
      setQuery(ticker);
      inputRef.current?.focus();
    },
    [],
  );

  const showDropdown = isOpen && debouncedQuery.length >= 1;

  return (
    <section className="text-center pt-16 pb-8 px-4">
      <h1 className="font-display text-4xl font-medium text-text-primary mb-6 tracking-tight">
        Search any S&amp;P 500 company
      </h1>

      <div className="relative max-w-[600px] mx-auto" ref={wrapperRef}>
        <div className="relative flex items-center">
          <span className="absolute left-4 text-text-tertiary pointer-events-none flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>

          <input
            ref={inputRef}
            className="w-full bg-elevated border border-border rounded-lg pl-12 pr-4 py-3 text-lg text-text-primary font-body placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted transition-colors"
            type="text"
            placeholder="Search by ticker or company name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (debouncedQuery.length >= 1) setIsOpen(true);
            }}
          />
        </div>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg z-50 max-h-[300px] overflow-y-auto">
            {isLoading && (
              <div className="px-4 py-3 text-center text-text-tertiary text-sm">
                Searching...
              </div>
            )}

            {!isLoading && results.length === 0 && (
              <div className="px-4 py-3 text-center text-text-tertiary text-sm">
                No results for &ldquo;{debouncedQuery}&rdquo;
              </div>
            )}

            {!isLoading &&
              results.map((company) => (
                <div
                  key={company.ticker}
                  className="px-4 py-3 hover:bg-elevated cursor-pointer flex items-center gap-3 text-text-primary transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(company.ticker)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSelect(company.ticker);
                  }}
                >
                  <span className="font-data font-bold text-accent text-sm min-w-[60px]">
                    {company.ticker}
                  </span>
                  <span className="font-body text-sm text-text-secondary truncate">
                    {company.name}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-text-tertiary">
        <span className="mr-1">Try:</span>
        {QUICK_TICKERS.map((ticker, i) => (
          <span key={ticker}>
            <button
              className="font-data text-sm font-medium text-text-tertiary hover:text-accent cursor-pointer bg-transparent border-none px-1.5 py-0.5 rounded transition-colors"
              onClick={() => handleQuickClick(ticker)}
            >
              {ticker}
            </button>
            {i < QUICK_TICKERS.length - 1 && (
              <span className="text-text-tertiary mx-0.5 select-none">&middot;</span>
            )}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  TrustCard Component                                                */
/* ------------------------------------------------------------------ */
function TrustCard({ eyebrow, title, body }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary mb-3">
        {eyebrow}
      </div>
      <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
        {title}
      </h3>
      <p className="font-body text-sm leading-relaxed text-text-secondary">
        {body}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LandingPage Root                                                   */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  return (
    <main>
      <SearchBar />

      <section className="max-w-[1280px] mx-auto py-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {RESEARCH_HIGHLIGHTS.map((item) => (
            <TrustCard
              key={item.title}
              eyebrow={item.eyebrow}
              title={item.title}
              body={item.body}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
