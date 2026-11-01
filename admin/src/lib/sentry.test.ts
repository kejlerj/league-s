import * as Sentry from '@sentry/react'
import type { BrowserOptions, ErrorEvent } from '@sentry/react'
import { initSentry, scrubBreadcrumb, scrubEvent, scrubSpan } from '@/lib/sentry'

type StreamedSpan = Parameters<NonNullable<BrowserOptions['beforeSendSpan']>>[0]

vi.mock('@sentry/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/react')>()),
  init: vi.fn(),
}))

afterEach(() => {
  vi.mocked(Sentry.init).mockClear()
})

test('without a DSN, Sentry is not initialised', () => {
  expect(initSentry({ MODE: 'production' })).toBe(false)
  expect(initSentry({ MODE: 'production', VITE_SENTRY_DSN: '' })).toBe(false)
  expect(Sentry.init).not.toHaveBeenCalled()
})

test('with a DSN, Sentry is initialised with the environment and release', () => {
  expect(
    initSentry({
      MODE: 'production',
      VITE_SENTRY_DSN: 'https://key@example.ingest.sentry.io/1',
      VITE_SENTRY_ENVIRONMENT: 'staging',
      VITE_SENTRY_RELEASE: 'admin@abc123',
    }),
  ).toBe(true)
  expect(Sentry.init).toHaveBeenCalledWith(
    expect.objectContaining({
      dsn: 'https://key@example.ingest.sentry.io/1',
      environment: 'staging',
      release: 'admin@abc123',
      dataCollection: expect.objectContaining({ userInfo: false }),
    }),
  )
})

test('the environment falls back to the Vite mode', () => {
  initSentry({ MODE: 'development', VITE_SENTRY_DSN: 'https://key@example.ingest.sentry.io/1' })
  expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ environment: 'development' }))
})

test('an error event never carries a reset or invitation token', () => {
  const event: ErrorEvent = {
    type: undefined,
    message: 'failed on /admin/reset-password?token=secret1',
    exception: { values: [{ type: 'Error', value: 'GET /invitations?token=secret2&x=1 failed' }] },
    request: {
      url: 'https://league.test/admin/reset-password?token=secret3',
      query_string: 'token=secret4',
      headers: { Referer: 'https://league.test/admin/accept-invitation?token=secret5' },
    },
    breadcrumbs: [{ category: 'navigation', data: { from: '/admin/reset-password?token=secret6', to: '/admin' } }],
  }

  const scrubbed = JSON.stringify(scrubEvent(event))

  expect(scrubbed).not.toMatch(/secret\d/)
  expect(scrubbed).toContain('token=[Filtered]&x=1')
})

test('a span never carries a token', () => {
  const span: StreamedSpan = {
    trace_id: '1',
    span_id: '2',
    name: 'GET /api/v1/invitations?token=secret1',
    start_timestamp: 0,
    status: 'ok',
    is_segment: false,
    attributes: { url: '/api/v1/invitations?token=secret2', 'http.response.status_code': 200 },
  }

  const scrubbed = scrubSpan(span)

  expect(JSON.stringify(scrubbed)).not.toMatch(/secret\d/)
  expect(scrubbed.attributes['http.response.status_code']).toBe(200)
})

test('a breadcrumb never carries a token', () => {
  const breadcrumb = scrubBreadcrumb({
    category: 'fetch',
    message: 'POST /api/v1/auth/reset?token=secret1',
    data: { url: '/api/v1/auth/reset?token=secret2', status_code: 200 },
  })

  expect(JSON.stringify(breadcrumb)).not.toMatch(/secret\d/)
  expect(breadcrumb.data?.status_code).toBe(200)
})
