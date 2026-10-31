function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function localToUtc(value: string): string {
  return new Date(value).toISOString()
}

export function utcToLocal(iso: string): string {
  const d = new Date(iso)
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDateTime(iso: string | null): string {
  if (iso === null) {
    return '—'
  }
  const d = new Date(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDate(date: string | null): string {
  if (date === null) {
    return '—'
  }
  const [year, month, day] = date.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

export function today(): string {
  return localDate(new Date())
}
