import { useState, useEffect, useCallback } from 'react'

/**
 * Generic data-fetching hook.
 *
 * @param {Function} fetchFn   - async function that returns data
 * @param {any}      mockData  - fallback mock value when API fails in dev
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
    try {
      const result = await fetchFn()
      setData(result)
      setUseMock(false)
    } catch (err) {
      if (mockData !== null && import.meta.env.MODE === 'development') {
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
