export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function toInt(value: string): number | null {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : null
}

export function omitEmpty<T extends Record<string, unknown>>(input: T): Partial<T> {
  const entries = Object.entries(input).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  )
  return Object.fromEntries(entries) as Partial<T>
}
