type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type Options = {
  body?: unknown
  query?: Record<string, string | undefined>
}

const BASE = '/api/v1'
const SILENT_401 = new Set(['GET /me', 'POST /auth/login'])

let unauthorizedHandler: () => void = () => {}

export class ApiError extends Error {
  readonly status: number
  readonly fields: Record<string, string> | null

  constructor(status: number, message: string, fields: Record<string, string> | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler
}

export function seg(value: string): string {
  return encodeURIComponent(value)
}

function buildUrl(path: string, query: Options['query']): string {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

async function toError(response: Response): Promise<ApiError> {
  const payload: unknown = await response.json().catch(() => null)
  if (payload !== null && typeof payload === 'object') {
    const { error, errors } = payload as { error?: unknown; errors?: unknown }
    if (errors !== null && typeof errors === 'object') {
      return new ApiError(response.status, 'validation', errors as Record<string, string>)
    }
    if (typeof error === 'string') {
      return new ApiError(response.status, error)
    }
  }
  return new ApiError(response.status, `HTTP ${response.status}`)
}

export async function api<T = void>(method: Method, path: string, opts: Options = {}): Promise<T> {
  const hasBody = opts.body !== undefined
  let response: Response
  try {
    response = await fetch(buildUrl(path, opts.query), {
      method,
      credentials: 'same-origin',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'network')
  }

  if (!response.ok) {
    if (response.status === 401 && !SILENT_401.has(`${method} ${path}`)) {
      unauthorizedHandler()
    }
    throw await toError(response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
