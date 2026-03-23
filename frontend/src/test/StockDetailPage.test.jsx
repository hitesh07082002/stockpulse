import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StockDetailPage from '../pages/StockDetailPage';
import { useCompany } from '../hooks/useStockData';

vi.mock('../hooks/useStockData', () => ({
  useCompany: vi.fn(),
}));

vi.mock('../components/tabs/OverviewTab', () => ({
  default: ({ company }) => <div>Overview stub {company?.ticker}</div>,
}));

vi.mock('../components/tabs/FinancialsTab', () => ({
  default: () => <div>Financials stub</div>,
}));

vi.mock('../components/tabs/PriceTab', () => ({
  default: () => <div>Price stub</div>,
}));

vi.mock('../components/tabs/ValuationTab', () => ({
  default: () => <div>Valuation stub</div>,
}));

vi.mock('../components/tabs/AITab', () => ({
  default: () => <div>AI stub</div>,
}));

function renderPage(entry = '/stock/MSFT') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/stock/:ticker" element={<StockDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StockDetailPage', () => {
  beforeEach(() => {
    vi.mocked(useCompany).mockReset();
  });

  it('renders the company header and overview tab for a valid ticker', () => {
    vi.mocked(useCompany).mockReturnValue({
      data: {
        ticker: 'MSFT',
        name: 'Microsoft Corporation',
        sector: 'Technology',
        industry: 'Software',
        market_cap: 3100000000000,
        current_price: 415.67,
        quote_updated_at: new Date().toISOString(),
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText(/Microsoft Corporation/i)).toBeInTheDocument();
    expect(screen.getByText(/Overview stub MSFT/i)).toBeInTheDocument();
  });

  it('renders the loading shell while company data is pending', () => {
    vi.mocked(useCompany).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    const { container } = renderPage();

    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('renders a search-facing 404 state when the ticker does not exist', () => {
    vi.mocked(useCompany).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage('/stock/VOID');

    expect(screen.getByText(/Company not found for ticker/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to search/i })).toBeInTheDocument();
  });

  it('renders the API error state with a recovery link', () => {
    vi.mocked(useCompany).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Backend unavailable'),
    });

    renderPage();

    expect(screen.getByText(/Backend unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to search/i })).toBeInTheDocument();
  });
});
