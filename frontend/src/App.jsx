import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider } from './components/auth/AuthContext';
import LandingPage from './pages/LandingPage';

const StockDetailPage = lazy(() => import('./pages/StockDetailPage'));
const ScreenerPage = lazy(() => import('./pages/ScreenerPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage'));

function RouteFallback() {
  return (
    <div className="min-h-[var(--shell-content-min-height)] px-4 py-10">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4">
        <div className="skeleton h-10 w-56 rounded" />
        <div className="skeleton h-6 w-80 rounded" />
        <div className="skeleton h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/reset-password"
            element={(
              <Suspense fallback={<RouteFallback />}>
                <PasswordResetPage />
              </Suspense>
            )}
          />
          <Route
            path="/stock/:ticker"
            element={(
              <Suspense fallback={<RouteFallback />}>
                <StockDetailPage />
              </Suspense>
            )}
          />
          <Route
            path="/screener"
            element={(
              <Suspense fallback={<RouteFallback />}>
                <ScreenerPage />
              </Suspense>
            )}
          />
          <Route
            path="/about"
            element={(
              <Suspense fallback={<RouteFallback />}>
                <AboutPage />
              </Suspense>
            )}
          />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}

export default App;
