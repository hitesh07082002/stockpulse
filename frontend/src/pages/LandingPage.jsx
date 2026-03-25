import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCompanySearch } from '../hooks/useStockData';
import { fetchPrices, fetchScreener } from '../utils/api';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'JPM'];

function formatPrice(value) {
  if (value == null) return '--';

  const number = Number(value);
  if (!Number.isFinite(number)) return '--';

  return `$${number.toFixed(2)}`;
}

function formatChange(value) {
  if (value == null) return null;

  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(2)}%`;
}

function getLatestClose(point) {
  const value = point?.adjusted_close ?? point?.close;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getDayChangePercent(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  const latest = getLatestClose(points.at(-1));
  const previous = getLatestClose(points.at(-2));
  if (latest == null || previous == null || previous === 0) {
    return null;
  }

  return ((latest - previous) / previous) * 100;
}

function normalizeSelectedIndex(index, resultCount) {
  if (resultCount === 0) {
    return -1;
  }

  if (index < -1) {
    return -1;
  }

  if (index >= resultCount) {
    return resultCount - 1;
  }

  return index;
}

async function fetchLiveCompanies() {
  const screenerPayload = await fetchScreener({
    sort: 'market_cap',
    order: 'desc',
  });

  const topCompanies = (screenerPayload?.results ?? []).slice(0, 5);
  if (topCompanies.length === 0) {
    return [];
  }

  return Promise.all(
    topCompanies.map(async (company) => {
      const pricePayload = await fetchPrices(company.ticker, '1M');
      const pricePoints = pricePayload?.data ?? [];
      const latestPrice = getLatestClose(pricePoints.at(-1));

      return {
        ticker: company.ticker,
        currentPrice: Number(company.current_price ?? latestPrice),
        changePercent: getDayChangePercent(pricePoints),
      };
    }),
  );
}

function SearchBar() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useCompanySearch(debouncedQuery);
  const results = data?.results ?? data ?? [];
  const showDropdown = isOpen && debouncedQuery.length >= 1;
  const activeIndex = normalizeSelectedIndex(selectedIndex, results.length);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showDropdown || activeIndex < 0) {
      return;
    }

    itemRefs.current[activeIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [activeIndex, showDropdown]);

  function handleSelect(ticker) {
    setQuery('');
    setDebouncedQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
    navigate(`/stock/${ticker}`);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    if (!showDropdown || results.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((currentIndex) => {
        const normalizedIndex = normalizeSelectedIndex(currentIndex, results.length);
        return Math.min(normalizedIndex + 1, results.length - 1);
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((currentIndex) => {
        const normalizedIndex = normalizeSelectedIndex(currentIndex, results.length);
        return Math.max(normalizedIndex - 1, -1);
      });
      return;
    }

    if (event.key === 'Enter') {
      if (activeIndex >= 0) {
        event.preventDefault();
        handleSelect(results[activeIndex].ticker);
        return;
      }

      if (selectedIndex === -1 && results.length === 1) {
        event.preventDefault();
        handleSelect(results[0].ticker);
      }
    }
  }

  return (
    <div className="relative w-full max-w-[600px]" ref={wrapperRef}>
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
          aria-expanded={showDropdown}
          aria-activedescendant={
            showDropdown && activeIndex >= 0
              ? `search-result-${results[activeIndex].ticker}`
              : undefined
          }
          aria-controls={showDropdown ? 'company-search-results' : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (debouncedQuery.length >= 1) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {showDropdown && (
        <div
          id="company-search-results"
          role="listbox"
          className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg z-50 max-h-[300px] overflow-y-auto"
        >
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
            results.map((company, index) => {
              const isSelected = activeIndex === index;

              return (
                <button
                  key={company.ticker}
                  id={`search-result-${company.ticker}`}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`w-full px-4 py-3 cursor-pointer flex items-center gap-3 text-text-primary transition-colors text-left ${
                    isSelected ? 'bg-elevated' : 'hover:bg-elevated'
                  }`}
                  aria-label={`${company.ticker} ${company.name}`}
                  onMouseEnter={() => setSelectedIndex(index)}
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
              );
            })}
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { data: liveCompanies, isLoading, isError } = useQuery({
    queryKey: ['landing', 'live-companies'],
    queryFn: fetchLiveCompanies,
    staleTime: 5 * 60 * 1000,
  });

  const showLiveStrip = !isLoading && !isError && (liveCompanies?.length ?? 0) > 0;

  return (
    <section className="min-h-[var(--shell-content-min-height)] px-4">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 py-16 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="font-display text-[3.5rem] leading-none font-medium tracking-tight text-text-primary">
            StockPulse
          </h1>
          <p className="max-w-[500px] font-body text-lg text-text-secondary">
            Financials, valuations, and AI analysis for every S&amp;P 500 company
          </p>
        </div>

        <SearchBar />

        <div className="flex flex-wrap justify-center gap-2">
          {QUICK_TICKERS.map((ticker) => (
            <button
              key={ticker}
              type="button"
              className="min-h-11 rounded-full border border-border bg-elevated px-4 py-2 font-data text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-hover"
              onClick={() => navigate(`/stock/${ticker}`)}
            >
              {ticker}
            </button>
          ))}
        </div>

        <p className="font-data text-sm text-text-tertiary">
          500 companies · 30yr SEC filings · Prices refresh every 15 min
        </p>

        {showLiveStrip && (
          <div className="w-full max-w-5xl">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                {liveCompanies.map((company) => (
                  <button
                    key={company.ticker}
                    type="button"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 font-data text-sm transition-colors hover:border-accent hover:bg-hover sm:min-h-0 sm:rounded-none sm:border-none sm:bg-transparent sm:px-0 sm:py-0 sm:hover:bg-transparent sm:hover:text-accent"
                    onClick={() => navigate(`/stock/${company.ticker}`)}
                  >
                    <span className="font-bold text-accent">{company.ticker}</span>
                    <span className="text-text-primary">{formatPrice(company.currentPrice)}</span>
                    {formatChange(company.changePercent) && (
                      <span
                        className={
                          Number(company.changePercent) >= 0 ? 'text-up' : 'text-down'
                        }
                      >
                        {formatChange(company.changePercent)}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
