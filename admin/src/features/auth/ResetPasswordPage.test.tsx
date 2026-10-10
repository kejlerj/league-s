import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

async function submit(user: ReturnType<typeof renderRoute>['user'], password = 'nouveau-mot-de-passe') {
  await user.type(await screen.findByLabelText('Nouveau mot de passe'), password)
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
}

test('sans jeton, le lien est invalide', async () => {
  renderRoute('/reset-password', { me: null })
  expect(await screen.findByText('Lien invalide ou expiré.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument()
})

test('succès', async () => {
  let body: unknown
  server.use(
    http.post(`${API}/auth/password-reset/confirm`, async ({ request }) => {
      body = await request.json()
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { user } = renderRoute('/reset-password?token=abc', { me: null })
  await submit(user)
  expect(await screen.findByText('Mot de passe modifié.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/login')
  expect(body).toEqual({ token: 'abc', password: 'nouveau-mot-de-passe' })
})

test('lien refusé par le serveur', async () => {
  server.use(
    http.post(`${API}/auth/password-reset/confirm`, () => HttpResponse.json({ error: 'invalid link' }, { status: 400 })),
  )
  const { user } = renderRoute('/reset-password?token=abc', { me: null })
  await submit(user)
  expect(await screen.findByText('Lien invalide ou expiré.')).toBeInTheDocument()
})

test('mot de passe refusé', async () => {
  server.use(
    http.post(`${API}/auth/password-reset/confirm`, () =>
      HttpResponse.json({ error: 'password must be at least 10 characters long' }, { status: 422 }),
    ),
  )
  const { user } = renderRoute('/reset-password?token=abc', { me: null })
  await submit(user)
  expect(await screen.findByText('Le mot de passe doit contenir au moins 10 caractères (72 octets au plus).')).toBeInTheDocument()
})
