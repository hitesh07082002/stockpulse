import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

function renderApp(initialEntry) {
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

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((input, init = {}) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init.method || 'GET';

      if (url.includes('/auth/session/')) {
        return Promise.resolve(jsonResponse(ANONYMOUS_SESSION));
      }

      if (url.includes('/auth/refresh/')) {
        return Promise.resolve(jsonResponse({ error: 'No refresh session available.' }, { status: 401 }));
      }

      if (url.includes('/auth/email-verification/confirm/') && method === 'POST') {
        return Promise.resolve(jsonResponse({
          message: 'Email verified. You can sign in now.',
        }));
      }

      if (url.includes('/auth/email-verification/resend/') && method === 'POST') {
        return Promise.resolve(jsonResponse({
          message: 'If an account exists for that email, we sent a verification link.',
        }));
      }

      throw new Error(`Unhandled fetch in VerifyEmailPage.test: ${method} ${url}`);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('confirms verification links from the URL', async () => {
    renderApp('/verify-email?uid=test-uid&token=test-token');

    expect(await screen.findByRole('heading', { name: /your account is ready/i })).toBeInTheDocument();
    expect(screen.getByText(/your email has been verified successfully/i)).toBeInTheDocument();
    const pageSection = screen.getByRole('heading', { name: /your account is ready/i }).closest('section');
    expect(within(pageSection).getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('resends a verification link from the pending state', async () => {
    renderApp('/verify-email?email=oracle@example.com');

    expect(await screen.findByRole('heading', { name: /verify your email/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }));

    expect(await screen.findByText(/sent a verification link/i)).toBeInTheDocument();
  });
});
