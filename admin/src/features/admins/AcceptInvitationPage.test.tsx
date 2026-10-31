import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

const preview = { email: 'nouveau@ligue.test', league: { id: 'L1', name: 'District Nord' }, account_exists: false }

function mockLookup(response: () => Response, bodies: unknown[] = []) {
  server.use(
    http.post(`${API}/invitations/lookup`, async ({ request }) => {
      bodies.push(await request.json())
      return response()
    }),
  )
}

test('nouveau compte : envoie le jeton, le nom et le mot de passe', async () => {
  const lookups: unknown[] = []
  let body: unknown
  mockLookup(() => HttpResponse.json(preview), lookups)
  server.use(
    http.post(`${API}/invitations/accept`, async ({ request }) => {
      body = await request.json()
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { user } = renderRoute('/invitation?token=tok%2F123', { me: null })
  expect(await screen.findByRole('heading', { name: 'Rejoindre District Nord' })).toBeInTheDocument()
  expect(screen.getByText('nouveau@ligue.test')).toBeInTheDocument()
  expect(lookups[0]).toEqual({ token: 'tok/123' })
  await user.type(screen.getByLabelText('Nom'), 'Nouvel Admin')
  await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse-long')
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  expect(await screen.findByText("C'est fait. Vous pouvez vous connecter.")).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/login')
  expect(body).toEqual({ token: 'tok/123', name: 'Nouvel Admin', password: 'motdepasse-long' })
})

test('compte existant : envoie seulement le jeton', async () => {
  let body: unknown
  mockLookup(() => HttpResponse.json({ ...preview, account_exists: true }))
  server.use(
    http.post(`${API}/invitations/accept`, async ({ request }) => {
      body = await request.json()
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { user } = renderRoute('/invitation?token=tok', { me: null })
  await user.click(await screen.findByRole('button', { name: 'Rejoindre la ligue' }))
  expect(await screen.findByText("C'est fait. Vous pouvez vous connecter.")).toBeInTheDocument()
  expect(body).toEqual({ token: 'tok' })
  expect(screen.queryByLabelText('Mot de passe')).not.toBeInTheDocument()
})

test('lien invalide au chargement', async () => {
  mockLookup(() => HttpResponse.json({ error: 'invalid link' }, { status: 400 }))
  renderRoute('/invitation?token=tok', { me: null })
  expect(await screen.findByText('Lien invalide ou expiré.')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('sans jeton, aucun appel et lien invalide', async () => {
  const lookups: unknown[] = []
  mockLookup(() => HttpResponse.json(preview), lookups)
  renderRoute('/invitation', { me: null })
  expect(await screen.findByText('Lien invalide ou expiré.')).toBeInTheDocument()
  expect(lookups).toEqual([])
})

test('mot de passe refusé', async () => {
  mockLookup(() => HttpResponse.json(preview))
  server.use(http.post(`${API}/invitations/accept`, () => HttpResponse.json({ error: 'x' }, { status: 422 })))
  const { user } = renderRoute('/invitation?token=tok', { me: null })
  await user.type(await screen.findByLabelText('Nom'), 'Nouvel Admin')
  await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse-long')
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  expect(await screen.findByText('Le mot de passe doit contenir au moins 10 caractères (72 octets au plus).')).toBeInTheDocument()
})

test("lien devenu invalide à l'envoi", async () => {
  mockLookup(() => HttpResponse.json({ ...preview, account_exists: true }))
  server.use(http.post(`${API}/invitations/accept`, () => HttpResponse.json({ error: 'x' }, { status: 400 })))
  const { user } = renderRoute('/invitation?token=tok', { me: null })
  await user.click(await screen.findByRole('button', { name: 'Rejoindre la ligue' }))
  expect(await screen.findByText('Lien invalide ou expiré.')).toBeInTheDocument()
})
