import { http, HttpResponse } from 'msw'
import { api, onUnauthorized, seg } from '@/api/client'
import { API, server } from '@/test/server'

test('api préfixe /api/v1, ajoute la query et ignore les valeurs undefined', async () => {
  let url = ''
  server.use(
    http.get(`${API}/x`, ({ request }) => {
      url = request.url
      return HttpResponse.json([])
    }),
  )
  await api('GET', '/x', { query: { a: '1', b: undefined } })
  expect(new URL(url).pathname).toBe('/api/v1/x')
  expect(new URL(url).search).toBe('?a=1')
})

test('api envoie le corps en JSON', async () => {
  let body: unknown
  let contentType: string | null = null
  server.use(
    http.post(`${API}/x`, async ({ request }) => {
      contentType = request.headers.get('content-type')
      body = await request.json()
      return HttpResponse.json({ ok: true })
    }),
  )
  expect(await api('POST', '/x', { body: { a: 1 } })).toEqual({ ok: true })
  expect(body).toEqual({ a: 1 })
  expect(contentType).toBe('application/json')
})

test('api renvoie undefined sur 204', async () => {
  server.use(http.post(`${API}/x`, () => new HttpResponse(null, { status: 204 })))
  expect(await api('POST', '/x')).toBeUndefined()
})

test('api convertit {error} en ApiError', async () => {
  server.use(http.post(`${API}/x`, () => HttpResponse.json({ error: 'nope' }, { status: 409 })))
  await expect(api('POST', '/x')).rejects.toMatchObject({ status: 409, message: 'nope', fields: null })
})

test('api expose les erreurs de champs', async () => {
  server.use(
    http.post(`${API}/x`, () => HttpResponse.json({ errors: { name: 'required' } }, { status: 422 })),
  )
  await expect(api('POST', '/x')).rejects.toMatchObject({ status: 422, fields: { name: 'required' } })
})

test('une erreur sans corps JSON donne HTTP <status>', async () => {
  server.use(http.get(`${API}/x`, () => new HttpResponse('boom', { status: 502 })))
  await expect(api('GET', '/x')).rejects.toMatchObject({ status: 502, message: 'HTTP 502' })
})

test('panne réseau donne status 0', async () => {
  server.use(http.get(`${API}/x`, () => HttpResponse.error()))
  await expect(api('GET', '/x')).rejects.toMatchObject({ status: 0 })
})

test('401 appelle onUnauthorized, sauf pour /me et /auth/login', async () => {
  const spy = vi.fn()
  onUnauthorized(spy)
  const r401 = () => HttpResponse.json({ error: 'x' }, { status: 401 })
  server.use(
    http.get(`${API}/me`, r401),
    http.post(`${API}/auth/login`, r401),
    http.post(`${API}/leagues`, r401),
  )
  await api('GET', '/me').catch(() => {})
  await api('POST', '/auth/login').catch(() => {})
  expect(spy).not.toHaveBeenCalled()
  await api('POST', '/leagues').catch(() => {})
  expect(spy).toHaveBeenCalledTimes(1)
})

test('seg encode les caractères réservés', () => {
  expect(seg('a/b?c')).toBe('a%2Fb%3Fc')
})
