import { useState, useCallback } from 'react'

interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  execute: (...args: any[]) => Promise<T | null>
}

export function useApi<T>(apiFunction: (...args: any[]) => Promise<any>): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(
    async (...args: any[]) => {
      setLoading(true)
      setError(null)
      try {
        const response = await apiFunction(...args)
        setData(response.data)
        return response.data
      } catch (err: any) {
        const message = err.response?.data?.detail || err.message || 'An error occurred'
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [apiFunction]
  )

  return { data, loading, error, execute }
}

export default useApi
