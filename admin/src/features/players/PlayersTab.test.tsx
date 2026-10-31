import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { adminOne, leagueL1, mockLeague, playerP1, playerP2 } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

function setup(queries: (string | null)[] = []) {
  mockLeague(leagueL1)
  server.use(
    http.get(`${API}/leagues/L1/players`, ({ request }) => {
      queries.push(new URL(request.url).searchParams.get('q'))
      return HttpResponse.json([playerP1, playerP2])
    }),
  )
  return renderRoute('/leagues/L1?tab=players', { me: adminOne })
}

test('lists the players', async () => {
  setup()
  expect(await screen.findByText('Léo Dupont')).toBeInTheDocument()
  expect(screen.getByText('Max Durand')).toBeInTheDocument()
})

test('the search sends q', async () => {
  const queries: (string | null)[] = []
  const { user } = setup(queries)
  await user.type(await screen.findByLabelText('Rechercher'), 'dup')
  await vi.waitFor(() => expect(queries).toContain('dup'))
  expect(queries).not.toContain('d')
})

test('create: an empty photo is sent as null', async () => {
  let body: unknown
  server.use(
    http.post(`${API}/leagues/L1/players`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...playerP1, id: 'P3' }, { status: 201 })
    }),
  )
  const { user } = setup()
  await user.click(await screen.findByRole('button', { name: 'Nouveau joueur' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Prénom'), 'Tom')
  await user.type(within(dialog).getByLabelText('Nom'), 'Petit')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(body).toEqual({ firstname: 'Tom', lastname: 'Petit', icon: null }))
})

test('edit: PATCH on the right path, without the empty photo', async () => {
  let body: unknown
  server.use(
    http.patch(`${API}/leagues/L1/players/P1`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(playerP1)
    }),
  )
  const { user } = setup()
  const row = (await screen.findByText('Léo Dupont')).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Modifier' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom'), 'd')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(body).toEqual({ firstname: 'Léo', lastname: 'Dupontd' }))
})

test('delete refused', async () => {
  server.use(http.delete(`${API}/leagues/L1/players/P1`, () => HttpResponse.json({ error: 'x' }, { status: 409 })))
  const { user } = setup()
  const row = (await screen.findByText('Léo Dupont')).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Supprimer' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
  expect(await screen.findByText('Ce joueur a un historique.')).toBeInTheDocument()
})
