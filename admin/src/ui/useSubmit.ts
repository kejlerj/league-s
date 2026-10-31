import { useCallback, useRef, useState } from 'react'
import { errorMessage } from './errorMessage'

export function useSubmit<A extends unknown[]>(
  fn: (...args: A) => Promise<unknown>,
  overrides?: Record<number, string>,
): { submit: (...args: A) => Promise<boolean>; pending: boolean; error: string | null } {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const latest = useRef({ fn, overrides })
  latest.current = { fn, overrides }

  const submit = useCallback(async (...args: A): Promise<boolean> => {
    if (busy.current) {
      return false
    }
    busy.current = true
    setPending(true)
    setError(null)
    try {
      await latest.current.fn(...args)
      return true
    } catch (err) {
      setError(errorMessage(err, latest.current.overrides))
      return false
    } finally {
      busy.current = false
      setPending(false)
    }
  }, [])

  return { submit, pending, error }
}
