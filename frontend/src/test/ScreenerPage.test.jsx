import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScreenerPage from '../pages/ScreenerPage';

const navigateMock = vi.fn();
const useScreenerMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../hooks/useStockData', () => ({
  useScreener: (...args) => useScreenerMock(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ScreenerPage />
    </MemoryRouter>,
  );
}

describe('ScreenerPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useScreenerMock.mockReset();
  });

  it('reveals advanced filters behind More filters', () => {
    useScreenerMock.mockReturnValue({
      data: { count: 0, results: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /more filters/i }));

    expect(screen.getByPlaceholderText(/semiconductors, software/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide more filters/i })).toBeInTheDocument();
  });

  it('navigates to the selected company from results', () => {
    useScreenerMock.mockReturnValue({
      data: {
        count: 1,
        results: [
          {
            ticker: 'AAPL',
            name: 'Apple Inc.',
            sector: 'Technology',
            current_price: 190.12,
            market_cap: 2_900_000_000_000,
            pe_ratio: 28.1,
            revenue_growth_yoy: 0.08,
            gross_margin: 0.46,
            operating_margin: 0.31,
            debt_to_equity: 1.2,
          },
        ],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByText('AAPL'));

    expect(navigateMock).toHaveBeenCalledWith('/stock/AAPL');
  });

  it('applies exact GICS sector values from the dropdown', async () => {
    useScreenerMock.mockReturnValue({
      data: { count: 0, results: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
      error: null,
    });

    renderPage();

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Information Technology' },
    });
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

    await waitFor(() => {
      expect(useScreenerMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ sector: 'Information Technology' }),
        'market_cap',
        'desc',
        1,
      );
    });
  });
});
