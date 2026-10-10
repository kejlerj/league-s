import { ApiError } from '@/api/client'

const GENERIC = 'Une erreur est survenue. Réessayez.'

const RULES: Record<string, string> = {
  required: 'obligatoire',
  email: 'e-mail invalide',
  http_url: 'URL http ou https attendue',
  min: 'trop petit',
  max: 'trop grand',
}

export function errorMessage(err: unknown, overrides: Record<number, string> = {}): string {
  if (!(err instanceof ApiError)) {
    return GENERIC
  }
  if (err.fields !== null) {
    const parts = Object.entries(err.fields).map(([field, rule]) => `${field} (${RULES[rule] ?? 'invalide'})`)
    return `Champs invalides : ${parts.join(', ')}`
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
  return err.message
}
