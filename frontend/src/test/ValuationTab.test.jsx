import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ValuationTab from '../components/tabs/ValuationTab';

const useValuationInputsMock = vi.fn();

vi.mock('../hooks/useStockData', () => ({
  useValuationInputs: (...args) => useValuationInputsMock(...args),
}));

describe('ValuationTab', () => {
  beforeEach(() => {
    useValuationInputsMock.mockReset();
  });

  it('shows the financial-sector not-applicable state', () => {
    useValuationInputsMock.mockReturnValue({
      data: {
        not_applicable: true,
        not_applicable_reason: 'Not applicable for financial sector companies.',
        warnings: ['Valuation is not applicable for financial sector companies in V1.'],
      },
      isLoading: false,
      error: null,
    });

    render(<ValuationTab ticker="SCHW" />);

    expect(screen.getAllByText(/not applicable for financial sector companies/i).length).toBeGreaterThan(0);
  });

  it('shows cash-flow mode availability reasons when guardrails block it', () => {
    useValuationInputsMock.mockReturnValue({
      data: {
        not_applicable: false,
        warnings: ['Cash Flow mode requires shares outstanding before per-share valuation can be shown.'],
        current_price: 100,
        projection_years_default: 5,
        earnings_mode: {
          available: true,
          current_metric_label: 'EPS',
          current_metric_value: 5,
          growth_rate_default: 10,
          terminal_multiple_default: 20,
          desired_return_default: 15,
          current_trading_multiple: 18,
        },
        cash_flow_mode: {
          available: false,
          availability_reason: 'Missing shares outstanding for per-share cash flow valuation.',
          current_metric_label: 'FCF Per Share',
          current_metric_value: null,
          growth_rate_default: 10,
          terminal_multiple_default: 15,
          desired_return_default: 15,
          current_trading_multiple: null,
        },
      },
      isLoading: false,
      error: null,
    });

    render(<ValuationTab ticker="MSFT" />);

    fireEvent.click(screen.getByRole('button', { name: /cash flow/i }));

    expect(screen.getAllByText(/missing shares outstanding for per-share cash flow valuation/i).length).toBeGreaterThan(0);
  });

  it('shows annualized return as the primary comparison metric', () => {
    useValuationInputsMock.mockReturnValue({
      data: {
        not_applicable: false,
        warnings: [],
        current_price: 100,
        projection_years_default: 5,
        earnings_mode: {
          available: true,
          current_metric_label: 'EPS',
          current_metric_value: 5,
          growth_rate_default: 10,
          terminal_multiple_default: 20,
          desired_return_default: 12,
          current_trading_multiple: 18,
        },
        cash_flow_mode: {
          available: true,
          current_metric_label: 'FCF Per Share',
          current_metric_value: 6,
          growth_rate_default: 8,
          terminal_multiple_default: 15,
          desired_return_default: 12,
          current_trading_multiple: 16,
        },
      },
      isLoading: false,
      error: null,
    });

    render(<ValuationTab ticker="AAPL" />);

    expect(screen.getByText(/Implied CAGR vs Today/i)).toBeInTheDocument();
    expect(screen.getByText('+10.00%')).toBeInTheDocument();
    expect(screen.getByText(/Total 5-year return: \+61.05%/i)).toBeInTheDocument();
    expect(screen.getByText(/Entry Price For 12.00% CAGR/i)).toBeInTheDocument();
  });
});
