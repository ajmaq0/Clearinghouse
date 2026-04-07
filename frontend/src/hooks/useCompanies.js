import { useApi, isDemoMode } from './useApi.js'
import { companiesApi } from '../api/companies.js'
import { MOCK_COMPANIES } from '../mock/fullDataset.js'

/**
 * Fetches the company list from the live backend.
 * Falls back to MOCK_COMPANIES on failure or when ?demo=true.
 *
 * Returns { companies, loading, isLive }
 *  - companies: array of company objects
 *  - loading:   true while the request is in flight
 *  - isLive:    true when data came from the real backend
 */
export function useCompanies() {
  const { data, loading, useMock } = useApi(
    () => companiesApi.list(),
    MOCK_COMPANIES,
    []
  )

  return {
    companies: data ?? MOCK_COMPANIES,
    loading,
    isLive: !useMock,
  }
}

/**
 * Returns the default SME company for live mode:
 * first company where gls_member === true and sector === 'food_beverage'.
 * Falls back to first company in the list.
 */
export function getDefaultSmeCompany(companies) {
  return (
    companies.find(c => c.gls_member === true && c.sector === 'food_beverage') ||
    companies[0]
  )
}
