import { useCallback, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import { errorMessage, fieldsMessage } from './errorMessage'

type FieldErrors = Record<string, string>

export type FieldProps = { error: string | null; onInput: () => void }

function baseName(key: string): string {
  return key.split(/[.[]/)[0]
}

function splitFieldErrors(fields: FieldErrors, known: Set<string>): { matched: FieldErrors; rest: FieldErrors } {
  const matched: FieldErrors = {}
  const rest: FieldErrors = {}
  for (const [key, message] of Object.entries(fields)) {
    const name = baseName(key)
    if (known.has(name)) {
      matched[name] ??= message
    } else {
      rest[key] = message
    }
  }
  return { matched, rest }
}

export function useSubmit<A extends unknown[]>(
  fn: (...args: A) => Promise<unknown>,
  overrides?: Record<number, string>,
): {
  submit: (...args: A) => Promise<boolean>
  pending: boolean
  error: string | null
  field: (name: string) => FieldProps
} {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const busy = useRef(false)
  const known = useRef(new Set<string>())
  const latest = useRef({ fn, overrides })
  latest.current = { fn, overrides }

  const submit = useCallback(async (...args: A): Promise<boolean> => {
    if (busy.current) {
      return false
    }
    busy.current = true
    setPending(true)
    setError(null)
    setFieldErrors({})
    try {
      await latest.current.fn(...args)
      return true
    } catch (err) {
      if (err instanceof ApiError && err.fields !== null) {
        const { matched, rest } = splitFieldErrors(err.fields, known.current)
        setFieldErrors(matched)
        setError(Object.keys(rest).length > 0 ? fieldsMessage(rest) : null)
      } else {
        setError(errorMessage(err, latest.current.overrides))
      }
      return false
    } finally {
      busy.current = false
      setPending(false)
    }
  }, [])

  const field = useCallback(
    (name: string): FieldProps => {
      known.current.add(name)
      return {
        error: fieldErrors[name] ?? null,
        onInput: () =>
          setFieldErrors((current) => {
            if (!(name in current)) {
              return current
            }
            const next = { ...current }
            delete next[name]
            return next
          }),
      }
    },
    [fieldErrors],
  )

  return { submit, pending, error, field }
}
