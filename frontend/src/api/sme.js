import { api } from './client.js'

export const smeApi = {
  companyPosition: (companyId) =>
    api.get(`/clearing/company-position?company_id=${companyId}`),

  companyInvoices: (companyId) =>
    api.get(`/invoices?company_id=${companyId}`),

  matchingHints: (companyId) =>
    api.get(`/network/matching-hints?company_id=${companyId}`),
}
