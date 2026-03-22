import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCompanySearch } from '../hooks/useStockData';

/* ------------------------------------------------------------------ */
/*  Placeholder data — will be replaced with real API calls later      */
/* ------------------------------------------------------------------ */
const TICKER_DATA = [
  { label: 'S&P 500',  price: '5,218.42', change: '+0.63%', up: true },
  { label: 'AAPL',     price: '214.29',    change: '+1.22%', up: true },
  { label: 'MSFT',     price: '420.55',    change: '-0.38%', up: false },
  { label: 'AMZN',     price: '186.40',    change: '+0.91%', up: true },
  { label: 'NVDA',     price: '878.37',    change: '-1.05%', up: false },
];

const TOP_GAINERS = [
  { ticker: 'SMCI',  change: '+12.43%', volume: '38.2M' },
  { ticker: 'ENPH',  change: '+8.17%',  volume: '14.7M' },
  { ticker: 'SEDG',  change: '+6.92%',  volume: '9.1M' },
  { ticker: 'MRNA',  change: '+5.48%',  volume: '11.3M' },
  { ticker: 'DXCM',  change: '+4.81%',  volume: '6.8M' },
];

const TOP_LOSERS = [
  { ticker: 'PARA',  change: '-7.61%',  volume: '22.4M' },
  { ticker: 'WBA',   change: '-5.33%',  volume: '18.9M' },
  { ticker: 'FMC',   change: '-4.89%',  volume: '5.2M' },
  { ticker: 'PAYC',  change: '-3.72%',  volume: '3.1M' },
  { ticker: 'BIO',   change: '-3.14%',  volume: '1.9M' },
];

const MOST_ACTIVE = [
  { ticker: 'TSLA',  change: '+2.15%',  volume: '112.6M' },
  { ticker: 'NVDA',  change: '-1.05%',  volume: '68.3M' },
  { ticker: 'AAPL',  change: '+1.22%',  volume: '54.1M' },
  { ticker: 'AMD',   change: '+0.78%',  volume: '49.8M' },
  { ticker: 'SMCI',  change: '+12.43%', volume: '38.2M' },
];

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'GOOGL', 'JPM'];

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
/*  MarketTicker Component                                             */
/* ------------------------------------------------------------------ */
function MarketTicker() {
  return (
    <div className="bg-surface border-y border-border py-3 px-4 flex items-center justify-center gap-8 overflow-x-auto">
      {TICKER_DATA.map((item) => (
        <div className="flex items-center gap-2 whitespace-nowrap" key={item.label}>
          <span className="font-body text-xs font-medium text-text-secondary">
            {item.label}
          </span>
          <span className="font-data text-sm text-text-primary">
            {item.price}
          </span>
          <span
            className={`font-data text-sm font-medium px-1.5 py-0.5 rounded ${
              item.up
                ? 'text-up bg-up/10'
                : 'text-down bg-down/10'
            }`}
          >
            {item.change}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MoverCard Component                                                */
/* ------------------------------------------------------------------ */
function MoverCard({ title, variant, data }) {
  const titleColorMap = {
    gainers: 'text-up',
    losers: 'text-down',
    active: 'text-accent',
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3
        className={`font-display text-sm font-bold uppercase tracking-wide mb-4 pb-2 border-b border-border ${
          titleColorMap[variant] || 'text-text-secondary'
        }`}
      >
        {title}
      </h3>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="font-body text-[10px] font-medium uppercase tracking-wide text-text-tertiary text-left pb-2">
              Ticker
            </th>
            <th className="font-body text-[10px] font-medium uppercase tracking-wide text-text-tertiary text-left pb-2">
              Change
            </th>
            <th className="font-body text-[10px] font-medium uppercase tracking-wide text-text-tertiary text-right pb-2">
              Volume
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const isUp = row.change.startsWith('+');
            return (
              <tr key={row.ticker} className="border-t border-border">
                <td className="font-data text-sm py-2">
                  <Link
                    to={`/stock/${row.ticker}`}
                    className="font-bold text-text-primary hover:text-accent transition-colors"
                  >
                    {row.ticker}
                  </Link>
                </td>
                <td
                  className={`font-data text-sm py-2 ${
                    isUp ? 'text-up' : 'text-down'
                  }`}
                >
                  {row.change}
                </td>
                <td className="font-data text-sm py-2 text-right text-text-secondary">
                  {row.volume}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
      <MarketTicker />

      <section className="max-w-[1280px] mx-auto py-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <MoverCard title="Top Gainers" variant="gainers" data={TOP_GAINERS} />
          <MoverCard title="Top Losers" variant="losers" data={TOP_LOSERS} />
          <MoverCard title="Most Active" variant="active" data={MOST_ACTIVE} />
        </div>
      </section>
    </main>
  );
}
