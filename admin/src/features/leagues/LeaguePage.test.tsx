import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { adminOne, leagueL1, leagueL2, mockLeague } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

test('LeaguePage affiche les cinq onglets, Matchs en premier', async () => {
  mockLeague(leagueL1)
  renderRoute('/leagues/L1', { me: adminOne })
  expect(await screen.findByRole('heading', { name: 'District Nord' })).toBeInTheDocument()
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Matchs', 'Équipes', 'Joueurs', 'Saisons', 'Admins'])
  expect(screen.getByRole('tab', { name: 'Matchs' })).toHaveAttribute('aria-selected', 'true')
})

test('ligue inconnue affiche Introuvable.', async () => {
  server.use(http.get(`${API}/leagues/L1`, () => HttpResponse.json({ error: 'not found' }, { status: 404 })))
  renderRoute('/leagues/L1', { me: adminOne })
  expect(await screen.findByText('Introuvable.')).toBeInTheDocument()
})

test('modifier une ligue envoie un PATCH sans le logo vide', async () => {
  let body: unknown
  mockLeague(leagueL1)
  server.use(
    http.patch(`${API}/leagues/L1`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...leagueL1, name: 'District Nord-Est' })
    }),
  )
  const { user } = renderRoute('/leagues/L1', { me: adminOne })
  await user.click(await screen.findByRole('button', { name: 'Modifier' }))
  const dialog = screen.getByRole('dialog')
  const name = within(dialog).getByLabelText('Nom')
  await user.clear(name)
  await user.type(name, 'District Nord-Est')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(body).toEqual({ name: 'District Nord-Est' }))
})

test('modifier une ligue préremplit le logo', async () => {
  mockLeague(leagueL2)
  const { user } = renderRoute('/leagues/L2')
  await user.click(await screen.findByRole('button', { name: 'Modifier' }))
  expect(within(screen.getByRole('dialog')).getByLabelText('Logo (URL)')).toHaveValue('https://img.test/sud.png')
})
