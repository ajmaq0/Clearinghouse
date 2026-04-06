import { api } from './client.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const clearingApi = {
  run:          ()   => api.post('/clearing/run', {}),
  runOptimal:   ()   => api.post('/clearing/run-optimal', {}),
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
  // Returns { cycles: ClearingHistoryEntry[], total_cycles }
  history: () => api.get('/clearing/history'),
  // Returns structured report data (network stats, clearing results, top-5 companies)
  getReport: () => api.get('/clearing/report'),
  // Fetches PDF blob — returns { blob, filename }
  downloadReportPdf: async () => {
    const today = new Date().toISOString().slice(0, 10)
    const filename = `ClearFlow_Bericht_${today}.pdf`
    const res = await fetch(`${BASE_URL}/clearing/report/pdf`)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`API error ${res.status}: ${text}`)
    }
    const blob = await res.blob()
    return { blob, filename }
  },
}
