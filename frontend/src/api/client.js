// ClearFlow API client
// Base URL is configured via VITE_API_BASE_URL env var or falls back to /api (proxied to :8000)

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  get:   (path)         => request(path),
  post:  (path, body)   => request(path, { method: 'POST',  body }),
  patch: (path, body)   => request(path, { method: 'PATCH', body }),
  del:   (path)         => request(path, { method: 'DELETE' }),
}
