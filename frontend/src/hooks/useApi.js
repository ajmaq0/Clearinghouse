import { useState, useEffect, useCallback } from 'react'

/**
 * Returns true when ?demo=true is present in the URL.
 * Demo mode forces mock data regardless of backend availability.
 */
export function isDemoMode() {
  return new URLSearchParams(window.location.search).get('demo') === 'true'
}

/**
 * Generic data-fetching hook with unified mock fallback.
 *
 * Behaviour:
 *  - ?demo=true  → skip real API, return mockData immediately
 *  - API failure → fall back to mockData (all environments)
 *  - API success → return live data
 *
 * @param {Function} fetchFn   - async function that returns data
 * @param {any}      mockData  - fallback value (null = no fallback)
 * @param {Array}    deps      - effect dependencies
 */
export function useApi(fetchFn, mockData = null, deps = []) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [useMock, setUseMock] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Demo mode: bypass backend entirely
    if (isDemoMode() && mockData !== null) {
      setData(mockData)
      setUseMock(true)
      setLoading(false)
      return
    }

    try {
      const result = await fetchFn()
      setData(result)
      setUseMock(false)
    } catch (err) {
      if (mockData !== null) {
        console.warn('[ClearFlow] API unavailable, using mock data:', err.message)
        setData(mockData)
        setUseMock(true)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { load() }, [load])

  return { data, loading, error, useMock, reload: load }
}
