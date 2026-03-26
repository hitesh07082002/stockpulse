import { describe, expect, it } from 'vitest';
import { buildValuationViewModel } from '../components/tabs/valuation/valuationModel';

describe('buildValuationViewModel', () => {
  it('computes projection summary values for earnings mode', () => {
    const viewModel = buildValuationViewModel({
      data: {
        current_price: 100,
        projection_years_default: 5,
        warnings: ['Top-level warning'],
        earnings_mode: {
          available: true,
          warnings: ['Mode warning'],
          current_metric_label: 'EPS',
          current_metric_value: 5,
          growth_rate_default: 10,
          terminal_multiple_default: 20,
          desired_return_default: 12,
          current_trading_multiple: 18,
        },
      },
      modeKey: 'earnings',
      modeDraft: {},
    });

    expect(viewModel.projectionData).toHaveLength(6);
    expect(viewModel.futurePrice).toBeCloseTo(161.051, 3);
    expect(viewModel.annualizedReturn).toBeCloseTo(10, 5);
    expect(viewModel.totalReturn).toBeCloseTo(61.051, 3);
    expect(viewModel.entryPrice).toBeCloseTo(91.38, 2);
    expect(viewModel.visibleWarnings).toEqual(['Top-level warning', 'Mode warning']);
    expect(viewModel.terminalLabel).toBe('Appropriate EPS Multiple');
  });

  it('blocks projection output when the current metric is missing', () => {
    const viewModel = buildValuationViewModel({
      data: {
        current_price: 100,
        projection_years_default: 5,
        cash_flow_mode: {
          available: true,
          warnings: [],
          current_metric_label: 'FCF Per Share',
          current_metric_value: null,
          growth_rate_default: 8,
          terminal_multiple_default: 15,
          desired_return_default: 12,
          current_trading_multiple: 16,
        },
      },
      modeKey: 'cashFlow',
      modeDraft: {},
    });

    expect(viewModel.projectionData).toEqual([]);
    expect(viewModel.futurePrice).toBeNull();
    expect(viewModel.annualizedReturn).toBeNull();
    expect(viewModel.entryPrice).toBeNull();
    expect(viewModel.projectionMessage).toBe(
      'Adjust the current metric and assumptions to see the five-year projection.',
    );
    expect(viewModel.terminalLabel).toBe('Appropriate FCF Multiple');
  });
});
