import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FinancialsTab from '../components/tabs/FinancialsTab';
import { useFinancials } from '../hooks/useStockData';

vi.mock('../hooks/useStockData', () => ({
  useFinancials: vi.fn(),
}));

describe('FinancialsTab', () => {
  beforeEach(() => {
    vi.mocked(useFinancials).mockReset();
  });

  it('renders the empty state when canonical facts are missing', () => {
    vi.mocked(useFinancials).mockReturnValue({
      data: {
        ticker: 'MSFT',
        period_type: 'annual',
        available_metrics: [],
        facts: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FinancialsTab ticker="MSFT" />);

    expect(
      screen.getByText(/No financial data filed with the SEC for MSFT/i),
    ).toBeInTheDocument();
  });

  it('renders the API error state when the query fails', () => {
    vi.mocked(useFinancials).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Financial endpoint failed'),
    });

    render(<FinancialsTab ticker="MSFT" />);

    expect(screen.getByText(/Financial endpoint failed/i)).toBeInTheDocument();
  });

  it('renders loading skeletons while facts are pending', () => {
    vi.mocked(useFinancials).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    const { container } = render(<FinancialsTab ticker="MSFT" />);

    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
