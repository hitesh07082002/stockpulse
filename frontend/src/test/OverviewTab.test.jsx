import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OverviewTab from '../components/tabs/OverviewTab';

describe('OverviewTab', () => {
  it('surfaces ROE alongside the other key overview metrics', () => {
    render(
      <OverviewTab
        ticker="AAPL"
        company={{
          name: 'Apple Inc.',
          market_cap: 3100000000000,
          pe_ratio: 29.4,
          latest_revenue: 383000000000,
          revenue_growth_yoy: 0.08,
          net_margin: 0.26,
          roe: 0.41,
          free_cash_flow: 99500000000,
          dividend_yield: 0.0045,
        }}
      />,
    );

    expect(screen.getByText('ROE')).toBeInTheDocument();
    expect(screen.getByText('41.00%')).toBeInTheDocument();
  });

  it('falls back to a placeholder when ROE is unavailable', () => {
    render(
      <OverviewTab
        ticker="AAPL"
        company={{
          name: 'Apple Inc.',
          market_cap: 3100000000000,
        }}
      />,
    );

    const statCards = screen.getAllByText('ROE');
    expect(statCards).toHaveLength(1);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
