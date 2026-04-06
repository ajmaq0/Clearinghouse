import { api } from './client.js'

// Normalize real API response to the field names the UI components expect.
// The backend returns snake_case names that differ from the mock data shape.
function normalizeStats(raw) {
  const grossCents = raw.total_gross_cents ?? 0
  const netCents   = raw.total_net_cents   ?? 0
  return {
    company_count:               raw.total_companies   ?? raw.company_count   ?? 0,
    invoice_count:               raw.total_invoices    ?? raw.invoice_count   ?? 0,
    confirmed_invoice_count:     raw.confirmed_invoice_count ?? null,
    gross_total_cents:           grossCents,
    last_clearing_savings_cents: grossCents - netCents,
    last_clearing_savings_pct:   raw.savings_percent   ?? (raw.savings_bps != null ? raw.savings_bps / 100 : 0),
    next_clearing_in_hours:      raw.next_clearing_in_hours ?? null,
    active_cycles:               raw.active_cycles ?? 0,
  }
}

export const networkApi = {
  stats:           () => api.get('/network/stats').then(normalizeStats),
  dashboard:       () => api.get('/network/dashboard'),
  topology:        () => api.get('/network/topology'),
  simulateGrowth:  (candidateIds) => api.post('/network/simulate-growth', { candidates: candidateIds }),
  cascadeSummary:  () => api.get('/network/cascade-summary'),
  cascade:         (companyId) => api.get(`/network/cascade?company_id=${encodeURIComponent(companyId)}`),
}
