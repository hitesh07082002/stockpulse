import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AuthModal from './auth/AuthModal';
import { useAuth } from './auth/useAuth';

function Layout({ children }) {
  const {
    authNotice,
    isAuthenticated,
    isBootstrapping,
    limits,
    logout,
    openAuthModal,
    setAuthNotice,
    user,
  } = useAuth();
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

  const userLabel = user?.name || user?.email || 'Signed in';
  const userInitial = (userLabel || 'U').trim().charAt(0).toUpperCase();
  const desktopNavLinkClasses = 'hidden font-body text-sm font-medium text-text-secondary no-underline transition-colors hover:text-text-primary md:inline-flex';
  const iconLinkClasses = 'flex h-11 w-11 items-center justify-center rounded-md border border-transparent p-0 text-text-secondary transition-colors hover:border-border hover:text-text-primary md:hidden';
  const iconButtonClasses = 'flex h-11 w-11 items-center justify-center rounded-md border border-border p-0 text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface backdrop-blur-md">
        <div className="mx-auto flex h-[var(--shell-header-height)] max-w-[1280px] items-center justify-between gap-3 px-4">
          <Link
            to="/"
            className="font-display font-bold text-xl text-accent no-underline tracking-tight"
          >
            StockPulse
          </Link>

          <nav className="flex items-center gap-1.5 sm:gap-2 md:gap-6">
            {!isBootstrapping && authNotice && (
              <button
                type="button"
                onClick={() => setAuthNotice(null)}
                className={`hidden rounded-full px-3 py-1 text-xs font-medium lg:inline-flex ${
                  authNotice.tone === 'error'
                    ? 'bg-[rgba(239,68,68,0.12)] text-[rgb(248,113,113)]'
                    : authNotice.tone === 'success'
                    ? 'bg-[rgba(16,185,129,0.12)] text-[rgb(110,231,183)]'
                    : 'bg-elevated text-text-secondary'
                }`}
              >
                {authNotice.message}
              </button>
            )}
            <Link
              to="/screener"
              className={desktopNavLinkClasses}
            >
              Screener
            </Link>
            <Link
              to="/about"
              className={desktopNavLinkClasses}
            >
              About
            </Link>
            <Link
              to="/screener"
              className={iconLinkClasses}
              aria-label="Open screener"
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
            </Link>
            <Link
              to="/about"
              className={iconLinkClasses}
              aria-label="About StockPulse"
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
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </Link>
            <button
              onClick={toggleTheme}
              className={iconButtonClasses}
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
            {isBootstrapping ? (
              <div className="hidden h-9 w-28 rounded-full bg-elevated md:block" />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1.5 md:flex">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-text-inverse">
                    {userInitial}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="max-w-[160px] truncate text-sm font-medium text-text-primary">
                      {userLabel}
                    </span>
                    <span className="text-[11px] text-text-tertiary">
                      {limits?.authenticated_daily || 50} AI prompts/day
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="min-h-11 rounded-full border border-border px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="min-h-11 rounded-full bg-accent px-3 py-2 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover sm:px-4"
              >
                Sign in
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-4 py-6">
        {children}
      </main>
      <AuthModal />
    </div>
  );
}

export default Layout;
