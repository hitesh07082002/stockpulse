import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PriceTab from '../components/tabs/PriceTab';

const usePricesMock = vi.fn();
const priceSeriesMock = {
  setData: vi.fn(),
  priceScale: () => ({
    applyOptions: vi.fn(),
  }),
};
const volumeSeriesMock = {
  setData: vi.fn(),
  priceScale: () => ({
    applyOptions: vi.fn(),
  }),
};
const addSeriesMock = vi.fn();
const removeSeriesMock = vi.fn();
const subscribeCrosshairMoveMock = vi.fn();
const unsubscribeCrosshairMoveMock = vi.fn();
const fitContentMock = vi.fn();
const setVisibleLogicalRangeMock = vi.fn();
const applyOptionsMock = vi.fn();
const removeChartMock = vi.fn();

vi.mock('../hooks/useStockData', () => ({
  usePrices: (...args) => usePricesMock(...args),
}));

vi.mock('lightweight-charts', () => ({
  createChart: () => ({
    addSeries: addSeriesMock,
    removeSeries: removeSeriesMock,
    subscribeCrosshairMove: subscribeCrosshairMoveMock,
    unsubscribeCrosshairMove: unsubscribeCrosshairMoveMock,
    timeScale: () => ({
      fitContent: fitContentMock,
      setVisibleLogicalRange: setVisibleLogicalRangeMock,
    }),
    applyOptions: applyOptionsMock,
    remove: removeChartMock,
  }),
  HistogramSeries: Symbol('HistogramSeries'),
  LineSeries: Symbol('LineSeries'),
}));

describe('PriceTab', () => {
  beforeEach(() => {
    usePricesMock.mockReset();
    addSeriesMock.mockReset();
    addSeriesMock
      .mockReturnValueOnce(priceSeriesMock)
      .mockReturnValueOnce(volumeSeriesMock);
    removeSeriesMock.mockReset();
    subscribeCrosshairMoveMock.mockReset();
    unsubscribeCrosshairMoveMock.mockReset();
    fitContentMock.mockReset();
    setVisibleLogicalRangeMock.mockReset();
    applyOptionsMock.mockReset();
    removeChartMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 360,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 280,
    });
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
    expect(screen.getByRole('button', { name: /show volume/i })).toBeInTheDocument();
    expect(screen.queryByText(/daily shares traded/i)).not.toBeInTheDocument();
    expect(screen.getByText(/price \$413\.42/i)).toBeInTheDocument();
  });

  it('reveals a clear volume summary only when the user enables it', () => {
    usePricesMock.mockReturnValue({
      data: {
        data: [{ date: '2026-03-20', adjusted_close: 413.42, close: 415.67, volume: 22610000 }],
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    render(<PriceTab ticker="MSFT" />);

    fireEvent.click(screen.getByRole('button', { name: /show volume/i }));

    expect(screen.getByText(/daily shares traded/i)).toBeInTheDocument();
    expect(screen.getByText(/volume 22\.61m shares/i)).toBeInTheDocument();
  });

  it('removes the volume series when the user hides volume again', () => {
    usePricesMock.mockReturnValue({
      data: {
        data: [{ date: '2026-03-20', adjusted_close: 413.42, close: 415.67, volume: 22610000 }],
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    render(<PriceTab ticker="MSFT" />);

    const toggle = screen.getByRole('button', { name: /show volume/i });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: /hide volume/i }));

    expect(removeSeriesMock).toHaveBeenCalledWith(volumeSeriesMock);
  });

  it('attaches resize tracking when history loads after the initial skeleton state', async () => {
    usePricesMock.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: false,
      isError: false,
      error: null,
    });

    const { rerender } = render(<PriceTab ticker="MSFT" />);

    usePricesMock.mockReturnValue({
      data: {
        data: [{ date: '2026-03-20', adjusted_close: 413.42, close: 415.67, volume: 22610000 }],
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    rerender(<PriceTab ticker="MSFT" />);

    await waitFor(() => {
      expect(applyOptionsMock).toHaveBeenCalledWith({ width: 360, height: 280 });
    });
  });

  it('resets the visible range when switching from 1Y to a shorter window', async () => {
    const oneYearData = Array.from({ length: 251 }, (_, index) => ({
      date: `2025-03-${String((index % 28) + 1).padStart(2, '0')}`,
      adjusted_close: 200 + index,
      close: 200 + index,
      volume: 1_000_000 + index,
    }));
    const oneMonthData = Array.from({ length: 20 }, (_, index) => ({
      date: `2026-03-${String(index + 1).padStart(2, '0')}`,
      adjusted_close: 240 + index,
      close: 240 + index,
      volume: 2_000_000 + index,
    }));

    usePricesMock.mockImplementation((_ticker, range) => ({
      data: {
        data: range === '1M' ? oneMonthData : oneYearData,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    }));

    render(<PriceTab ticker="MSFT" />);

    await waitFor(() => {
      expect(setVisibleLogicalRangeMock).toHaveBeenCalledWith({ from: -1.1, to: 251.1 });
    });

    fireEvent.click(screen.getByRole('button', { name: '1M', exact: true }));

    await waitFor(() => {
      expect(setVisibleLogicalRangeMock).toHaveBeenLastCalledWith({ from: -1.1, to: 20.1 });
    });
  });
});
