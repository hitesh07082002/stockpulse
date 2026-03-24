import { useMemo, useState } from 'react';
import {
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_KEY,
  INITIAL_FILTERS,
} from '../components/screener/screener-config';
import {
  buildFilterPayload,
  countActiveFilters,
  getDefaultSortDirection,
} from '../components/screener/screener-utils';

export function useScreenerControls({ isDesktop }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useState(DEFAULT_SORT_DIRECTION);
  const [page, setPage] = useState(1);

  const activeFilterCount = useMemo(
    () => countActiveFilters(appliedFilters),
    [appliedFilters],
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = () => {
    setAppliedFilters(buildFilterPayload(filters));
    setPage(1);

    if (!isDesktop) {
      setShowMobileFilters(false);
    }
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters({});
    setSortKey(DEFAULT_SORT_KEY);
    setSortDir(DEFAULT_SORT_DIRECTION);
    setPage(1);
    setShowMoreFilters(false);
    setShowMobileFilters(false);
  };

  const sortBy = (key) => {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(getDefaultSortDirection(key));
    }
    setPage(1);
  };

  const changeSortKey = (nextSortKey) => {
    setSortKey(nextSortKey);
    setSortDir(getDefaultSortDirection(nextSortKey));
    setPage(1);
  };

  const applyMarketCapPreset = (preset) => {
    setFilters((current) => ({
      ...current,
      market_cap_min: preset.min,
      market_cap_max: preset.max,
    }));
  };

  return {
    activeFilterCount,
    appliedFilters,
    applyFilters,
    applyMarketCapPreset,
    changeSortKey,
    clearFilters,
    closeMobileFilters: () => setShowMobileFilters(false),
    filters,
    openMobileFilters: () => setShowMobileFilters(true),
    page,
    setPage,
    showMobileFilters,
    showMoreFilters,
    sortBy,
    sortDir,
    sortKey,
    toggleMoreFilters: () => setShowMoreFilters((current) => !current),
    updateFilter,
  };
}
