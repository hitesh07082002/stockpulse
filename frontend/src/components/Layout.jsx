import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Layout({ children }) {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sp-theme') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('sp-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface border-b border-border backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="font-display font-bold text-xl text-accent no-underline tracking-tight"
          >
            StockPulse
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              to="/screener"
              className="font-body text-sm font-medium text-text-secondary no-underline hover:text-text-primary transition-colors"
            >
              Screener
            </Link>
            <Link
              to="/about"
              className="font-body text-sm font-medium text-text-secondary no-underline hover:text-text-primary transition-colors"
            >
              About
            </Link>
            <button
              onClick={() => navigate('/screener')}
              className="flex items-center justify-center bg-transparent border-none text-text-secondary cursor-pointer p-1 rounded-md hover:text-text-primary transition-colors"
              aria-label="Search stocks"
            >
              <svg
                width="18"
                height="18"
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
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center bg-transparent border border-border text-text-secondary cursor-pointer p-2 rounded-md hover:text-text-primary hover:border-border-hover transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center">
        <span className="font-body text-sm text-text-tertiary">
          Powered by SEC EDGAR + AI
        </span>
      </footer>
    </div>
  );
}

export default Layout;
