import { useQuery } from '@tanstack/react-query';
import {
  fetchCompanies,
  fetchCompany,
  fetchFinancials,
  fetchPrices,
  fetchDCFInputs,
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
  const { metric, period_type } = options;
  return useQuery({
    queryKey: ['financials', ticker, { metric, period_type }],
    queryFn: () => fetchFinancials(ticker, { metric, period_type }),
    enabled: !!ticker,
  });
}

export function usePrices(ticker, range) {
  return useQuery({
    queryKey: ['prices', ticker, range],
    queryFn: () => fetchPrices(ticker, range),
    enabled: !!ticker,
  });
}

export function useDCFInputs(ticker) {
  return useQuery({
    queryKey: ['dcf-inputs', ticker],
    queryFn: () => fetchDCFInputs(ticker),
    enabled: !!ticker,
  });
}

export function useScreener(filters) {
  return useQuery({
    queryKey: ['screener', filters],
    queryFn: () => fetchScreener(filters),
  });
}
