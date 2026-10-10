import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { adminOne, mockMe } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

async function fillAndSubmit(user: ReturnType<typeof renderRoute>['user']) {
  await user.type(await screen.findByLabelText('E-mail'), 'nord@ligue.test')
  await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse-long')
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
}

test('connexion réussie ramène à la page demandée', async () => {
  let body: unknown
  const { user } = renderRoute('/leagues/L1', { me: null })
  server.use(
    http.post(`${API}/auth/login`, async ({ request }) => {
      body = await request.json()
      mockMe(adminOne)
      return HttpResponse.json(adminOne)
    }),
  )
  await fillAndSubmit(user)
  expect(await screen.findByText('Ligue')).toBeInTheDocument()
  expect(body).toEqual({ email: 'nord@ligue.test', password: 'motdepasse-long' })
})

test('identifiants faux', async () => {
  const { user } = renderRoute('/login', { me: null })
  server.use(http.post(`${API}/auth/login`, () => HttpResponse.json({ error: 'invalid credentials' }, { status: 401 })))
  await fillAndSubmit(user)
  expect(await screen.findByText('E-mail ou mot de passe incorrect.')).toBeInTheDocument()
})

test('trop de tentatives', async () => {
  const { user } = renderRoute('/login', { me: null })
  server.use(http.post(`${API}/auth/login`, () => new HttpResponse(null, { status: 429 })))
  await fillAndSubmit(user)
  expect(await screen.findByText('Trop de tentatives. Réessayez dans une minute.')).toBeInTheDocument()
})

test('déjà connecté, /login redirige vers l\'accueil', async () => {
  renderRoute('/login', { me: adminOne })
  expect(await screen.findByText('Admin')).toBeInTheDocument()
})
