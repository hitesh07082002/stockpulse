import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args) => useQueryMock(...args),
}));

describe('usePrices', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue({ data: null });
  });

  it('keeps the previous price payload visible while a new range is fetching', async () => {
    const { usePrices } = await import('../hooks/useStockData');

    usePrices('AAPL', '5Y');

    expect(useQueryMock).toHaveBeenCalledTimes(1);
    const config = useQueryMock.mock.calls[0][0];

    expect(config.queryKey).toEqual(['prices', 'AAPL', '5Y']);
    expect(config.enabled).toBe(true);
    expect(config.staleTime).toBe(60 * 1000);
    expect(config.placeholderData).toBeTypeOf('function');

    const previousPayload = { data: [{ date: '2026-03-27', adjusted_close: 248.8 }] };
    expect(config.placeholderData(previousPayload)).toBe(previousPayload);
  });
});
