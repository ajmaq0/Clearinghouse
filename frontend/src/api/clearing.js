import { api } from './client.js'

export const clearingApi = {
  run:        ()   => api.post('/clearing/run', {}),
  listCycles: ()   => api.get('/clearing/cycles'),
  getCycle:   (id) => api.get(`/clearing/cycles/${id}`),
  // getResults is an alias for getCycle — the detail endpoint returns full results
  getResults: (id) => api.get(`/clearing/cycles/${id}`),
}
