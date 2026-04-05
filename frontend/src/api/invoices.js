import { api } from './client.js'

export const invoicesApi = {
  list:    (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`/invoices${qs ? '?' + qs : ''}`)
  },
  getById: (id)  => api.get(`/invoices/${id}`),
  create:  (body)=> api.post('/invoices', body),
  confirm: (id)  => api.patch(`/invoices/${id}/confirm`, {}),
}
