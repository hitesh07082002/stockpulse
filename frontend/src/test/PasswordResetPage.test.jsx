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

describe('PasswordResetPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((input, init = {}) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init.method || 'GET').toUpperCase();

      if (url.includes('/auth/session/') && method === 'GET') {
        return Promise.resolve(jsonResponse(ANONYMOUS_SESSION));
      }

      if (url.includes('/auth/refresh/') && method === 'POST') {
        return Promise.resolve(jsonResponse({ error: 'No refresh session available.' }, { status: 401 }));
      }

      if (url.includes('/auth/password-reset/request/') && method === 'POST') {
        return Promise.resolve(jsonResponse({
          message: 'If an account exists for that email, we sent a reset link.',
        }));
      }

      if (url.includes('/auth/password-reset/confirm/') && method === 'POST') {
        return Promise.resolve(jsonResponse({
          message: 'Password updated. Sign in with your new password.',
        }));
      }

      if (url.includes('/screener/') && method === 'GET') {
        return Promise.resolve(jsonResponse({ count: 0, results: [] }));
      }

      throw new Error(`Unhandled fetch in PasswordResetPage.test: ${method} ${url}`);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests a reset link and can return to the sign-in modal', async () => {
    renderApp('/reset-password');

    fireEvent.change(await screen.findByPlaceholderText(/you@example.com/i), {
      target: { value: 'oracle@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByRole('heading', { name: /check your inbox/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/sign in to stockpulse/i)).toBeInTheDocument();
  });

  it('confirms a password reset from the emailed link state', async () => {
    renderApp('/reset-password?uid=test-uid&token=test-token');

    fireEvent.change(await screen.findByPlaceholderText(/at least 8 characters/i), {
      target: { value: 'NewStockPulse123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your new password/i), {
      target: { value: 'NewStockPulse123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByRole('heading', { name: /you can sign in now/i })).toBeInTheDocument();
    expect(screen.getByText(/your password was updated successfully/i)).toBeInTheDocument();
  });

  it('shows the incomplete-link state when reset params are missing', async () => {
    renderApp('/reset-password?uid=only-uid');

    expect(await screen.findByRole('heading', { name: /this link is incomplete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request a new link/i })).toBeInTheDocument();
  });
});
