import { describe, expect, it } from 'vitest';
import {
  buildFilterPayload,
  countActiveFilters,
  getDefaultSortDirection,
} from '../components/screener/screener-utils';

describe('screener utils', () => {
  it('builds API payloads with percent normalization and boolean filters', () => {
    expect(buildFilterPayload({
      sector: 'Information Technology',
      revenue_growth_min: '15',
      gross_margin_max: '42',
      positive_fcf: true,
      industry: '',
    })).toEqual({
      sector: 'Information Technology',
      revenue_growth_min: '0.15',
      gross_margin_max: '0.42',
      positive_fcf: 'true',
    });
  });

  it('counts only active filter values', () => {
    expect(countActiveFilters({
      sector: 'Information Technology',
      industry: '',
      positive_fcf: false,
      pe_min: '10',
    })).toBe(2);
  });

  it('returns the right default sort direction for text and numeric columns', () => {
    expect(getDefaultSortDirection('ticker')).toBe('asc');
    expect(getDefaultSortDirection('market_cap')).toBe('desc');
  });
});
