import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { adminOne, leagueL1, mockLeague, seasonS1 } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

function setup() {
  mockLeague(leagueL1)
  server.use(http.get(`${API}/leagues/L1/seasons`, () => HttpResponse.json([seasonS1])))
  return renderRoute('/leagues/L1?tab=seasons', { me: adminOne })
}

async function openNew(user: ReturnType<typeof renderRoute>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Nouvelle saison' }))
  return screen.getByRole('dialog')
}

test('liste les saisons avec un lien vers chacune', async () => {
  setup()
  expect(await screen.findByRole('link', { name: '2026-2027' })).toHaveAttribute('href', '/leagues/L1/seasons/S1')
  expect(screen.getByText('01/09/2026')).toBeInTheDocument()
})

test('création envoie les dates en UTC et les valeurs par défaut', async () => {
  let body: unknown
  server.use(
    http.post(`${API}/leagues/L1/seasons`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(seasonS1, { status: 201 })
    }),
  )
  const { user } = setup()
  const dialog = await openNew(user)
  await user.type(within(dialog).getByLabelText('Nom'), '2027-2028')
  await user.type(within(dialog).getByLabelText('Début'), '2027-09-01')
  await user.type(within(dialog).getByLabelText('Fin'), '2028-06-30')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() =>
    expect(body).toEqual({
      name: '2027-2028',
      start_on: '2027-09-01T00:00:00Z',
      end_on: '2028-06-30T00:00:00Z',
      match_win_pts: 3,
      match_draw_pts: 1,
      match_loss_pts: 0,
      tie_breakers: ['goal_difference', 'goals_scored'],
    }),
  )
})

test("les départages partent dans l'ordre de sélection", async () => {
  let body: { tie_breakers?: string[] } = {}
  server.use(
    http.post(`${API}/leagues/L1/seasons`, async ({ request }) => {
      body = (await request.json()) as typeof body
      return HttpResponse.json(seasonS1, { status: 201 })
    }),
  )
  const { user } = setup()
  const dialog = await openNew(user)
  await user.type(within(dialog).getByLabelText('Nom'), 'X')
  await user.type(within(dialog).getByLabelText('Début'), '2027-09-01')
  await user.type(within(dialog).getByLabelText('Fin'), '2028-06-30')
  await user.click(within(dialog).getByLabelText('Différence de buts'))
  await user.click(within(dialog).getByLabelText('Confrontations directes'))
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(body.tie_breakers).toEqual(['goals_scored', 'head_to_head']))
})

test("fin avant début bloque l'envoi", async () => {
  let called = false
  server.use(
    http.post(`${API}/leagues/L1/seasons`, () => {
      called = true
      return HttpResponse.json(seasonS1, { status: 201 })
    }),
  )
  const { user } = setup()
  const dialog = await openNew(user)
  await user.type(within(dialog).getByLabelText('Nom'), 'X')
  await user.type(within(dialog).getByLabelText('Début'), '2027-09-01')
  await user.type(within(dialog).getByLabelText('Fin'), '2027-09-01')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('La fin doit être après le début.')).toBeInTheDocument()
  expect(called).toBe(false)
})

test('modification préremplit les dates et envoie un PATCH', async () => {
  let body: unknown
  server.use(
    http.patch(`${API}/leagues/L1/seasons/S1`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(seasonS1)
    }),
  )
  const { user } = setup()
  const row = (await screen.findByRole('link', { name: '2026-2027' })).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Modifier' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByLabelText('Début')).toHaveValue('2026-09-01')
  expect(within(dialog).getByLabelText('Fin')).toHaveValue('2027-06-30')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() =>
    expect(body).toEqual({
      name: '2026-2027',
      start_on: '2026-09-01T00:00:00Z',
      end_on: '2027-06-30T00:00:00Z',
      match_win_pts: 3,
      match_draw_pts: 1,
      match_loss_pts: 0,
      tie_breakers: ['goal_difference', 'goals_scored'],
    }),
  )
})

test('suppression 409', async () => {
  server.use(http.delete(`${API}/leagues/L1/seasons/S1`, () => HttpResponse.json({ error: 'x' }, { status: 409 })))
  const { user } = setup()
  const row = (await screen.findByRole('link', { name: '2026-2027' })).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Supprimer' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
  expect(await screen.findByText('Cette saison a des matchs.')).toBeInTheDocument()
})
