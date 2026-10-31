import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { adminOne } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

async function fill(user: ReturnType<typeof renderRoute>['user'], next: string, confirm: string) {
  await user.type(await screen.findByLabelText('Mot de passe actuel'), 'ancien-mot-de-passe')
  await user.type(screen.getByLabelText('Nouveau mot de passe'), next)
  await user.type(screen.getByLabelText('Confirmation'), confirm)
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
}

test('success', async () => {
  let body: unknown
  server.use(
    http.put(`${API}/me/password`, async ({ request }) => {
      body = await request.json()
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { user } = renderRoute('/account', { me: adminOne })
  await fill(user, 'nouveau-mot-de-passe', 'nouveau-mot-de-passe')
  expect(await screen.findByText('Mot de passe modifié.')).toBeInTheDocument()
  expect(body).toEqual({ current_password: 'ancien-mot-de-passe', new_password: 'nouveau-mot-de-passe' })
})

test('a different confirmation makes no call', async () => {
  let called = false
  server.use(
    http.put(`${API}/me/password`, () => {
      called = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { user } = renderRoute('/account', { me: adminOne })
  await fill(user, 'nouveau-mot-de-passe', 'autre-mot-de-passe')
  expect(await screen.findByText('Les mots de passe ne correspondent pas.')).toBeInTheDocument()
  expect(called).toBe(false)
})

test('wrong current password', async () => {
  server.use(http.put(`${API}/me/password`, () => HttpResponse.json({ error: 'current password is wrong' }, { status: 403 })))
  const { user } = renderRoute('/account', { me: adminOne })
  await fill(user, 'nouveau-mot-de-passe', 'nouveau-mot-de-passe')
  expect(await screen.findByText('Mot de passe actuel incorrect.')).toBeInTheDocument()
})

test('new password refused', async () => {
  server.use(
    http.put(`${API}/me/password`, () =>
      HttpResponse.json({ error: 'password must be at most 72 bytes long' }, { status: 422 }),
    ),
  )
  const { user } = renderRoute('/account', { me: adminOne })
  await fill(user, 'nouveau-mot-de-passe', 'nouveau-mot-de-passe')
  expect(await screen.findByText('Le mot de passe doit contenir au moins 10 caractères (72 octets au plus).')).toBeInTheDocument()
})
