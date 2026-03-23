import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import App from '../App';

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

  it('renders the about page on the about route', async () => {
    renderApp('/about');

    expect(
      await screen.findByRole('heading', { name: /about stockpulse/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/data sources/i)).toBeInTheDocument();
  });
});
