import {
  DEFAULT_SORT_DIRECTION,
  PERCENT_FILTER_KEYS,
} from './screener-config';

export function formatMarketCap(value) {
  if (value == null) return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
  return `$${num.toLocaleString()}`;
}

export function formatNumber(value, decimals = 2) {
  if (value == null) return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return num.toFixed(decimals);
}

export function formatPercent(value) {
  if (value == null) return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return `${(num * 100).toFixed(2)}%`;
}

export function formatPrice(value) {
  if (value == null) return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return `$${num.toFixed(2)}`;
}

export function countActiveFilters(filters) {
  return Object.values(filters).filter((value) => value !== '' && value != null && value !== false).length;
}

export function buildFilterPayload(filters) {
  const payload = {};

  Object.entries(filters).forEach(([key, rawValue]) => {
    if (rawValue === '' || rawValue == null) return;

    if (key === 'positive_fcf') {
      if (rawValue) {
        payload[key] = 'true';
      }
      return;
    }

    if (PERCENT_FILTER_KEYS.has(key)) {
      payload[key] = String(Number(rawValue) / 100);
      return;
    }

    payload[key] = rawValue;
  });

  return payload;
}

export function getDefaultSortDirection(key) {
  return ['ticker', 'name', 'sector'].includes(key)
    ? 'asc'
    : DEFAULT_SORT_DIRECTION;
}
