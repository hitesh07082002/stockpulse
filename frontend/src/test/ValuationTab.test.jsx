import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ValuationTab from '../components/tabs/ValuationTab';

const useValuationInputsMock = vi.fn();

vi.mock('../hooks/useStockData', () => ({
  useValuationInputs: (...args) => useValuationInputsMock(...args),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="projection-chart">{children}</div>,
  LineChart: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe('ValuationTab', () => {
  beforeEach(() => {
    useValuationInputsMock.mockReset();
  });

  it('shows the financial-sector caution only in cash-flow mode', () => {
    useValuationInputsMock.mockReturnValue({
      data: {
        not_applicable: false,
        warnings: [],
        current_price: 70,
        projection_years_default: 5,
        guardrails: {
          financial_sector_caution: true,
        },
        earnings_mode: {
          available: true,
          warnings: [],
          current_metric_label: 'EPS',
          current_metric_value: 3,
          growth_rate_default: 8,
          terminal_multiple_default: 14,
          desired_return_default: 15,
          current_trading_multiple: 20,
        },
        cash_flow_mode: {
          available: true,
          warnings: ['Financial companies fit a simplified cash-flow DCF less cleanly, so use this output as a rough framing tool.'],
          current_metric_label: 'FCF Per Share',
          current_metric_value: 4,
          growth_rate_default: 6,
          terminal_multiple_default: 10,
          desired_return_default: 15,
          current_trading_multiple: 17,
        },
      },
      isLoading: false,
      error: null,
    });

    render(<ValuationTab ticker="SCHW" />);

    expect(screen.queryByText(/financial companies fit a simplified cash-flow dcf less cleanly/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /assumptions/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /5-year projection/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cash flow/i }));

    expect(screen.getByText(/financial companies fit a simplified cash-flow dcf less cleanly/i)).toBeInTheDocument();
  });

  it('shows cash-flow mode availability reasons when guardrails block it', () => {
    useValuationInputsMock.mockReturnValue({
      data: {
        not_applicable: false,
        warnings: [],
        current_price: 100,
        projection_years_default: 5,
        earnings_mode: {
          available: true,
          warnings: [],
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
          warnings: ['Cash Flow mode requires shares outstanding before per-share valuation can be shown.'],
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
          warnings: [],
          current_metric_label: 'EPS',
          current_metric_value: 5,
          growth_rate_default: 10,
          terminal_multiple_default: 20,
          desired_return_default: 12,
          current_trading_multiple: 18,
        },
        cash_flow_mode: {
          available: true,
          warnings: [],
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
