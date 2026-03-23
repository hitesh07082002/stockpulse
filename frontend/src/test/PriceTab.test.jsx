import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PriceTab from '../components/tabs/PriceTab';

const usePricesMock = vi.fn();

vi.mock('../hooks/useStockData', () => ({
  usePrices: (...args) => usePricesMock(...args),
}));

vi.mock('lightweight-charts', () => ({
  createChart: () => ({
    addSeries: () => ({
      setData: vi.fn(),
      priceScale: () => ({
        applyOptions: vi.fn(),
      }),
    }),
    timeScale: () => ({
      fitContent: vi.fn(),
    }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  }),
  HistogramSeries: Symbol('HistogramSeries'),
  LineSeries: Symbol('LineSeries'),
}));

describe('PriceTab', () => {
  beforeEach(() => {
    usePricesMock.mockReset();
  });

  it('renders the empty-state copy when no history exists', () => {
    usePricesMock.mockReturnValue({
      data: { data: [], message: 'No price history available' },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    render(<PriceTab ticker="MSFT" />);

    expect(screen.getByText(/no price history available/i)).toBeInTheDocument();
  });

  it('renders the stale badge when cached price data is stale', () => {
    usePricesMock.mockReturnValue({
      data: {
        data: [{ date: '2026-03-20', adjusted_close: 413.42, close: 415.67, volume: 1000 }],
        stale: true,
        fetched_at: '2026-03-20T00:00:00Z',
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    render(<PriceTab ticker="MSFT" />);

    expect(screen.getByText(/stale/i)).toBeInTheDocument();
    expect(screen.getByText(/adjusted close/i)).toBeInTheDocument();
  });
});
