import * as Sentry from '@sentry/react'
import type { Breadcrumb, BrowserOptions, ErrorEvent } from '@sentry/react'
import { useEffect } from 'react'
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from 'react-router'

export type SentryEnv = {
  MODE: string
  VITE_SENTRY_DSN?: string
  VITE_SENTRY_ENVIRONMENT?: string
  VITE_SENTRY_RELEASE?: string
}

type TransactionEvent = Parameters<NonNullable<BrowserOptions['beforeSendTransaction']>>[0]

const FILTERED = '[Filtered]'
const tokenInUrl = /(token=)[^&\s"'#]+/gi

function scrub(value: string): string {
  return value.replace(tokenInUrl, `$1${FILTERED}`)
}

function scrubValues(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? scrub(value) : value]),
  )
}

function scrubHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, scrub(value)]))
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: breadcrumb.message && scrub(breadcrumb.message),
    data: breadcrumb.data && scrubValues(breadcrumb.data),
  }
}

export function scrubEvent<T extends ErrorEvent | TransactionEvent>(event: T): T {
  const { request } = event
  return {
    ...event,
    message: event.message && scrub(event.message),
    transaction: event.transaction && scrub(event.transaction),
    exception: event.exception && {
      values: event.exception.values?.map((value) => ({ ...value, value: value.value && scrub(value.value) })),
    },
    request: request && {
      ...request,
      url: request.url && scrub(request.url),
      query_string: typeof request.query_string === 'string' ? scrub(request.query_string) : undefined,
      headers: request.headers && scrubHeaders(request.headers),
    },
    breadcrumbs: event.breadcrumbs?.map(scrubBreadcrumb),
    spans: event.spans?.map((span) => ({
      ...span,
      description: span.description && scrub(span.description),
      data: span.data && scrubValues(span.data),
    })),
  }
}

export function initSentry(env: SentryEnv): boolean {
  if (!env.VITE_SENTRY_DSN) return false
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_SENTRY_ENVIRONMENT || env.MODE,
    release: env.VITE_SENTRY_RELEASE || undefined,
    dataCollection: { userInfo: false, cookies: false, urlQueryParams: false, httpBodies: [] },
    integrations: [
      Sentry.reactRouterBrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    tracesSampleRate: 0.2,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  })
  return true
}
