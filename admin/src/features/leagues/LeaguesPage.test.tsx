import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { adminOne, adminTwo, leagueL1, leagueL2, mockLeague } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

test('an admin of one league is redirected into it', async () => {
  mockLeague(leagueL1)
  renderRoute('/', { me: adminOne })
  expect(await screen.findByRole('heading', { name: 'District Nord' })).toBeInTheDocument()
})

test('an admin of two leagues sees their leagues, without create or delete', async () => {
  renderRoute('/', { me: adminTwo })
  expect(await screen.findByRole('link', { name: 'District Nord' })).toHaveAttribute('href', '/leagues/L1')
  expect(screen.getByRole('link', { name: 'District Sud' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Nouvelle ligue' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
})

test('the superadmin creates a league; an empty logo is sent as null', async () => {
  let body: unknown
  server.use(
    http.get(`${API}/leagues`, () => HttpResponse.json([leagueL1])),
    http.post(`${API}/leagues`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ id: 'L3', name: 'Ligue Test', logo: null }, { status: 201 })
    }),
  )
  const { user } = renderRoute('/')
  await user.click(await screen.findByRole('button', { name: 'Nouvelle ligue' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom'), 'Ligue Test')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(body).toEqual({ name: 'Ligue Test', logo: null }))
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('a refused delete shows Cette ligue a un historique.', async () => {
  server.use(
    http.get(`${API}/leagues`, () => HttpResponse.json([leagueL1, leagueL2])),
    http.delete(`${API}/leagues/L1`, () => HttpResponse.json({ error: 'league has history' }, { status: 409 })),
  )
  const { user } = renderRoute('/')
  const row = (await screen.findByRole('link', { name: 'District Nord' })).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Supprimer' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
  expect(await screen.findByText('Cette ligue a un historique.')).toBeInTheDocument()
})

test('a superadmin with a single existing league stays on the list', async () => {
  server.use(http.get(`${API}/leagues`, () => HttpResponse.json([leagueL1])))
  renderRoute('/')
  expect(await screen.findByRole('link', { name: 'District Nord' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nouvelle ligue' })).toBeInTheDocument()
})
