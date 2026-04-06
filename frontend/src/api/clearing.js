import { api } from './client.js'

export const clearingApi = {
  run:          ()   => api.post('/clearing/run', {}),
  listCycles:   ()   => api.get('/clearing/cycles'),
  getCycle:     (id) => api.get(`/clearing/cycles/${id}`),
  // getResults is an alias for getCycle — the detail endpoint returns full results
  getResults:   (id) => api.get(`/clearing/cycles/${id}`),
  // Returns { gross_cents, bilateral_cents, multilateral_cents, savings_eur_cents, savings_vs_gross_bps }
  multilateral: ()   => api.post('/clearing/multilateral', {}),
  // Returns { gross_cents, bilateral_cents, johnson_cents, optimal_cents,
  //           optimal_savings_cents, optimal_savings_pct,
  //           improvement_over_johnson_cents, improvement_over_johnson_pct,
  //           cleared_edges, lp_status }
  optimal:      ()   => api.post('/clearing/optimal', {}),
  // Returns { rows: CompanyComparisonRow[], total_companies, lp_status }
  companyComparison: () => api.get('/clearing/company-comparison'),
}
