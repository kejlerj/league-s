import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { adminOne, leagueL1, mockLeague, teamA, teamB } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

function setup() {
  mockLeague(leagueL1)
  server.use(http.get(`${API}/leagues/L1/teams`, () => HttpResponse.json([teamA, teamB])))
  return renderRoute('/leagues/L1', { me: adminOne })
}

test('liste les équipes', async () => {
  setup()
  expect(await screen.findByText('AS Alpha')).toBeInTheDocument()
  expect(screen.getByText('FC Bravo')).toBeInTheDocument()
})

test('création : le logo vide part en null', async () => {
  let body: unknown
  server.use(
    http.post(`${API}/leagues/L1/teams`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...teamA, id: 'T3', name: 'US Charlie' }, { status: 201 })
    }),
  )
  const { user } = setup()
  await user.click(await screen.findByRole('button', { name: 'Nouvelle équipe' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom'), 'US Charlie')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(body).toEqual({ name: 'US Charlie', logo: null }))
})

test('modification : PATCH sans la clé logo si elle est vide', async () => {
  let body: unknown
  server.use(
    http.patch(`${API}/leagues/L1/teams/T1`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...teamA, name: 'AS Alpha B' })
    }),
  )
  const { user } = setup()
  const row = (await screen.findByText('AS Alpha')).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Modifier' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom'), ' B')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(body).toEqual({ name: 'AS Alpha B' }))
})

test('suppression refusée', async () => {
  server.use(http.delete(`${API}/leagues/L1/teams/T1`, () => HttpResponse.json({ error: 'x' }, { status: 409 })))
  const { user } = setup()
  const row = (await screen.findByText('AS Alpha')).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Supprimer' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
  expect(await screen.findByText('Cette équipe a un historique.')).toBeInTheDocument()
})
