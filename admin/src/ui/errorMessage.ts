import { ApiError } from '@/api/client'

const GENERIC = 'Une erreur est survenue. Réessayez.'

export function fieldsMessage(fields: Record<string, string>): string {
  const parts = Object.entries(fields).map(([field, message]) => `${field} (${message})`)
  return `Champs invalides : ${parts.join(', ')}`
}

export function errorMessage(err: unknown, overrides: Record<number, string> = {}): string {
  if (!(err instanceof ApiError)) {
    return GENERIC
  }
  if (err.fields !== null) {
    return fieldsMessage(err.fields)
  }
  const override = overrides[err.status]
  if (override !== undefined) {
    return override
  }
  if (err.status === 0 || err.status >= 500) {
    return GENERIC
  }
  if (err.status === 403) {
    return 'Accès refusé.'
  }
  if (err.status === 429) {
    return 'Trop de tentatives. Réessayez dans une minute.'
  }
  if (err.message === `HTTP ${err.status}`) {
    return GENERIC
  }
  return err.message
}
