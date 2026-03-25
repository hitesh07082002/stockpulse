import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const ANONYMOUS_SESSION = {
  is_authenticated: false,
  user: null,
  limits: {
    anonymous_daily: 10,
    authenticated_daily: 50,
    current_daily: 10,
  },
  google_signin_available: true,
  has_refresh_session: false,
};

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function createFetchStub() {
  return vi.fn((input) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/auth/session/')) {
      return Promise.resolve(jsonResponse(ANONYMOUS_SESSION));
    }

    if (url.includes('/auth/refresh/')) {
      return Promise.resolve(jsonResponse({ error: 'No refresh session available.' }, { status: 401 }));
    }

    if (url.includes('/screener/')) {
      return Promise.resolve(jsonResponse({
        count: 1,
        results: [
          {
            ticker: 'MSFT',
            name: 'Microsoft Corporation',
            sector: 'Technology',
            current_price: '415.67',
            market_cap: 3100000000000,
          },
        ],
      }));
    }

    if (url.includes('/companies/MSFT/prices/')) {
      return Promise.resolve(jsonResponse({
        data: [
          { date: '2026-03-20', adjusted_close: 410.0, close: 410.0 },
          { date: '2026-03-21', adjusted_close: 415.67, close: 415.67 },
        ],
      }));
    }

    throw new Error(`Unhandled fetch in App.test: ${url}`);
  });
}

function renderApp(initialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('App routes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createFetchStub());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the search-first landing page on the root route', () => {
    renderApp('/');

    expect(
      screen.getByRole('heading', { name: /stockpulse/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search by ticker or company name/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/500 companies · 30yr sec filings · prices refresh every 15 min/i),
    ).toBeInTheDocument();
  });

  it('does not hit refresh for a fully anonymous bootstrap session', async () => {
    const fetchSpy = createFetchStub();
    vi.stubGlobal('fetch', fetchSpy);

    renderApp('/');

    await screen.findByRole('heading', { name: /stockpulse/i });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(
      fetchSpy.mock.calls.some(([request]) => request.toString().includes('/auth/session/')),
    ).toBe(true);
    expect(
      fetchSpy.mock.calls.some(([request]) => request.toString().includes('/auth/refresh/')),
    ).toBe(false);
  });

  it('renders the about page on the about route', async () => {
    renderApp('/about');

    expect(
      await screen.findByRole('heading', { name: /about stockpulse/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/how the data works/i)).toBeInTheDocument();
  });
});
