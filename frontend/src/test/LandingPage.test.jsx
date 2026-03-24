import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage from '../pages/LandingPage';
import { useCompanySearch } from '../hooks/useStockData';
import { fetchPrices, fetchScreener } from '../utils/api';

vi.mock('../hooks/useStockData', () => ({
  useCompanySearch: vi.fn(),
}));

vi.mock('../utils/api', async () => {
  const actual = await vi.importActual('../utils/api');
  return {
    ...actual,
    fetchPrices: vi.fn(),
    fetchScreener: vi.fn(),
  };
});

function StockRouteStub() {
  const { ticker } = useParams();
  return <div>{`Stock ${ticker}`}</div>;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <MemoryRouter initialEntries={['/']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/stock/:ticker" element={<StockRouteStub />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.mocked(useCompanySearch).mockReset();
    vi.mocked(fetchScreener).mockReset();
    vi.mocked(fetchPrices).mockReset();

    vi.mocked(useCompanySearch).mockReturnValue({
      data: { results: [] },
      isLoading: false,
    });
    vi.mocked(fetchScreener).mockResolvedValue({ results: [] });
    vi.mocked(fetchPrices).mockResolvedValue({ data: [] });
  });

  it('supports keyboard navigation through search results', async () => {
    vi.mocked(useCompanySearch).mockImplementation((query) => ({
      data: query
        ? {
            results: [
              { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
              { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
            ],
          }
        : { results: [] },
      isLoading: false,
    }));

    renderPage();

    const input = screen.getByPlaceholderText(/search by ticker or company name/i);

    fireEvent.change(input, { target: { value: 'm' } });

    expect(await screen.findByRole('option', { name: /AAPL Apple Inc\./i })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText(/Stock MSFT/i)).toBeInTheDocument();
  });

  it('renders the live data strip when market leaders load successfully', async () => {
    vi.mocked(fetchScreener).mockResolvedValue({
      results: [
        {
          ticker: 'AAPL',
          current_price: '198.11',
        },
      ],
    });
    vi.mocked(fetchPrices).mockResolvedValue({
      data: [
        { date: '2026-03-20', adjusted_close: 190.0, close: 190.0 },
        { date: '2026-03-21', adjusted_close: 195.0, close: 195.0 },
      ],
    });

    renderPage();

    expect(await screen.findByText('+2.63%')).toBeInTheDocument();
    expect(screen.getByText('$198.11')).toBeInTheDocument();
  });
});
