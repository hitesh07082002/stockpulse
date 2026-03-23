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
};

const AUTHENTICATED_SESSION = {
  is_authenticated: true,
  user: {
    id: 7,
    email: 'oracle@example.com',
    name: 'Oracle User',
    providers: ['email'],
  },
  limits: {
    anonymous_daily: 10,
    authenticated_daily: 50,
    current_daily: 50,
  },
  google_signin_available: true,
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

describe('Auth flow', () => {
  beforeEach(() => {
    let currentSession = ANONYMOUS_SESSION;

    vi.stubGlobal('fetch', vi.fn((input, init = {}) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init.method || 'GET';

      if (url.includes('/auth/session/')) {
        return Promise.resolve(jsonResponse(currentSession));
      }

      if (url.includes('/auth/refresh/')) {
        return Promise.resolve(jsonResponse({ error: 'No refresh session available.' }, { status: 401 }));
      }

      if (url.includes('/auth/register/') && method === 'POST') {
        currentSession = AUTHENTICATED_SESSION;
        return Promise.resolve(jsonResponse(AUTHENTICATED_SESSION, { status: 201 }));
      }

      if (url.includes('/auth/login/') && method === 'POST') {
        currentSession = AUTHENTICATED_SESSION;
        return Promise.resolve(jsonResponse(AUTHENTICATED_SESSION));
      }

      if (url.includes('/auth/logout/') && method === 'POST') {
        currentSession = ANONYMOUS_SESSION;
        return Promise.resolve(jsonResponse({ ok: true }));
      }

      throw new Error(`Unhandled fetch in AuthFlow.test: ${method} ${url}`);
    }));

    document.cookie = 'csrftoken=test-token';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('supports register, logout, and login from the auth modal', async () => {
    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: /^sign in$/i }));
    const authDialog = screen.getByRole('dialog');
    expect(authDialog).toBeInTheDocument();

    fireEvent.click(within(authDialog).getByRole('button', { name: /create account/i }));
    const registerDialog = screen.getByRole('dialog');
    fireEvent.click(within(registerDialog).getByRole('button', { name: /use email instead/i }));
    fireEvent.change(within(registerDialog).getByPlaceholderText(/your name/i), { target: { value: 'Oracle User' } });
    fireEvent.change(within(registerDialog).getByPlaceholderText(/you@example.com/i), { target: { value: 'oracle@example.com' } });
    fireEvent.change(within(registerDialog).getByPlaceholderText(/at least 8 characters/i), { target: { value: 'StockPulse123!' } });
    fireEvent.click(within(registerDialog).getAllByRole('button', { name: /^create account$/i })[1]);

    expect(await screen.findByText(/oracle user/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(await screen.findByRole('button', { name: /^sign in$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    const loginDialog = screen.getByRole('dialog');
    fireEvent.click(within(loginDialog).getByRole('button', { name: /use email instead/i }));
    fireEvent.change(within(loginDialog).getByPlaceholderText(/you@example.com/i), { target: { value: 'oracle@example.com' } });
    fireEvent.change(within(loginDialog).getByPlaceholderText(/at least 8 characters/i), { target: { value: 'StockPulse123!' } });
    fireEvent.click(within(loginDialog).getByRole('button', { name: /sign in with email/i }));

    expect(await screen.findByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByText(/50 ai prompts\/day/i)).toBeInTheDocument();
  });
});
