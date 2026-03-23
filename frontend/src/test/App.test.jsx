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
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/auth/session/')) {
        return Promise.resolve(jsonResponse(ANONYMOUS_SESSION));
      }

      if (url.includes('/auth/refresh/')) {
        return Promise.resolve(jsonResponse({ error: 'No refresh session available.' }, { status: 401 }));
      }

      throw new Error(`Unhandled fetch in App.test: ${url}`);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the search-first landing page on the root route', () => {
    renderApp('/');

    expect(
      screen.getByRole('heading', { name: /search any s&p 500 company/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search by ticker or company name/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/normalized sec financial data for 500 s&p companies/i),
    ).toBeInTheDocument();
  });

  it('does not hit refresh for a fully anonymous bootstrap session', async () => {
    const fetchSpy = vi.fn((input) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/auth/session/')) {
        return Promise.resolve(jsonResponse(ANONYMOUS_SESSION));
      }

      if (url.includes('/auth/refresh/')) {
        return Promise.resolve(jsonResponse({ error: 'No refresh session available.' }, { status: 401 }));
      }

      throw new Error(`Unhandled fetch in App.test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchSpy);

    renderApp('/');

    await screen.findByRole('heading', { name: /search any s&p 500 company/i });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0].toString()).toContain('/auth/session/');
  });

  it('renders the about page on the about route', async () => {
    renderApp('/about');

    expect(
      await screen.findByRole('heading', { name: /about stockpulse/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/data sources/i)).toBeInTheDocument();
  });
});
