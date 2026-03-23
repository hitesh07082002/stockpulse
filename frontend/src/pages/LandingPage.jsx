import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCompanySearch } from '../hooks/useStockData';

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
      setQuery('');
      setIsOpen(false);
      navigate(`/stock/${ticker}`);
    },
    [navigate],
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
                No companies match
              </div>
            )}

            {!isLoading &&
              results.map((company) => (
                <button
                  key={company.ticker}
                  type="button"
                  className="w-full px-4 py-3 hover:bg-elevated cursor-pointer flex items-center gap-3 text-text-primary transition-colors text-left"
                  aria-label={`${company.ticker} ${company.name}`}
                  onClick={() => handleSelect(company.ticker)}
                >
                  <span className="font-data font-bold text-accent text-sm min-w-[60px]">
                    {company.ticker}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-body text-sm text-text-secondary truncate">
                      {company.name}
                    </span>
                    {company.sector && (
                      <span className="block font-body text-xs text-text-tertiary truncate">
                        {company.sector}
                      </span>
                    )}
                  </span>
                </button>
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

      <div className="mt-6 font-body text-sm text-text-secondary">
        Normalized SEC financial data for 500 S&amp;P companies.
        <Link
          to="/screener"
          className="ml-2 text-accent hover:text-accent-hover transition-colors"
        >
          Open screener
        </Link>
        <span className="mx-2 text-text-tertiary">/</span>
        <Link
          to="/about"
          className="text-accent hover:text-accent-hover transition-colors"
        >
          Methodology
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  LandingPage Root                                                   */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  return (
    <main className="min-h-[calc(100vh-56px-80px)]">
      <SearchBar />
    </main>
  );
}
