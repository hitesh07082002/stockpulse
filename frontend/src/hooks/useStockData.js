import { useQuery } from '@tanstack/react-query';
import {
  fetchCompanies,
  fetchCompany,
  fetchFinancials,
  fetchPrices,
  fetchValuationInputs,
  fetchScreener,
} from '../utils/api';

export function useCompanySearch(query) {
  return useQuery({
    queryKey: ['companies', 'search', query],
    queryFn: () => fetchCompanies({ search: query }),
    enabled: query?.length >= 1,
  });
}

export function useCompany(ticker) {
  return useQuery({
    queryKey: ['company', ticker],
    queryFn: () => fetchCompany(ticker),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFinancials(ticker, options = {}) {
  const { metrics, period_type } = options;
  return useQuery({
    queryKey: ['financials', ticker, { metrics, period_type }],
    queryFn: () => fetchFinancials(ticker, { metrics, period_type }),
    enabled: !!ticker,
  });
}

export function usePrices(ticker, range) {
  return useQuery({
    queryKey: ['prices', ticker, range],
    queryFn: () => fetchPrices(ticker, range),
    enabled: !!ticker,
    staleTime: 60 * 1000,
  });
}

export function useValuationInputs(ticker) {
  return useQuery({
    queryKey: ['valuation-inputs', ticker],
    queryFn: () => fetchValuationInputs(ticker),
    enabled: !!ticker,
  });
}

export function useScreener(filters, sort, order, page) {
  return useQuery({
    queryKey: ['screener', filters, sort, order, page],
    queryFn: () => fetchScreener({
      ...filters,
      sort,
      order,
      page,
    }),
    placeholderData: (previousData) => previousData,
  });
}
