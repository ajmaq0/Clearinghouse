import { api } from './client.js'

export const companiesApi = {
  list:      ()         => api.get('/companies'),
  getById:   (id)       => api.get(`/companies/${id}`),
  getPos:    (id)       => api.get(`/companies/${id}/position`),
  create:    (body)     => api.post('/companies', body),
}
