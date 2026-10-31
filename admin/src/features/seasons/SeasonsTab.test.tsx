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

test('lists the seasons with a link to each one', async () => {
  setup()
  expect(await screen.findByRole('link', { name: '2026-2027' })).toHaveAttribute('href', '/leagues/L1/seasons/S1')
  expect(screen.getByText('01/09/2026')).toBeInTheDocument()
})

test('create sends the dates as YYYY-MM-DD and the default values, without max_squad_size when empty', async () => {
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
      start_on: '2027-09-01',
      end_on: '2028-06-30',
      match_win_pts: 3,
      match_draw_pts: 1,
      match_loss_pts: 0,
      tie_breakers: ['goal_difference', 'goals_scored'],
    }),
  )
})

test('tie breakers are sent in the order they were selected', async () => {
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

test('an end before the start blocks submitting', async () => {
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
  expect(await within(dialog).findByText('La fin doit être après le début.')).toBeInTheDocument()
  expect(within(dialog).getByLabelText('Fin')).toHaveAccessibleDescription('La fin doit être après le début.')
  expect(called).toBe(false)
})

test('edit prefills the dates and sends a PATCH without max_squad_size', async () => {
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
  expect(within(dialog).getByLabelText("Taille max. d'un effectif")).toBeDisabled()
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() =>
    expect(body).toEqual({
      name: '2026-2027',
      start_on: '2026-09-01',
      end_on: '2027-06-30',
      match_win_pts: 3,
      match_draw_pts: 1,
      match_loss_pts: 0,
      tie_breakers: ['goal_difference', 'goals_scored'],
    }),
  )
})

test('delete answered 409', async () => {
  server.use(http.delete(`${API}/leagues/L1/seasons/S1`, () => HttpResponse.json({ error: 'x' }, { status: 409 })))
  const { user } = setup()
  const row = (await screen.findByRole('link', { name: '2026-2027' })).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Supprimer' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
  expect(await screen.findByText('Cette saison a des matchs.')).toBeInTheDocument()
})

async function fillNew(user: ReturnType<typeof renderRoute>['user']) {
  const dialog = await openNew(user)
  await user.type(within(dialog).getByLabelText('Nom'), '2027-2028')
  await user.type(within(dialog).getByLabelText('Début'), '2027-09-01')
  await user.type(within(dialog).getByLabelText('Fin'), '2028-06-30')
  return dialog
}

test('create sends max_squad_size when it is set', async () => {
  let body: { max_squad_size?: number } = {}
  server.use(
    http.post(`${API}/leagues/L1/seasons`, async ({ request }) => {
      body = (await request.json()) as typeof body
      return HttpResponse.json(seasonS1, { status: 201 })
    }),
  )
  const { user } = setup()
  const dialog = await fillNew(user)
  await user.type(within(dialog).getByLabelText("Taille max. d'un effectif"), '12')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(body.max_squad_size).toBe(12))
})

test('a 422 on end_on and max_squad_size shows each message under its field', async () => {
  server.use(
    http.post(`${API}/leagues/L1/seasons`, () =>
      HttpResponse.json({ errors: { end_on: 'doit être après start_on', max_squad_size: 'doit être au moins 1' } }, { status: 422 }),
    ),
  )
  const { user } = setup()
  const dialog = await fillNew(user)
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  expect(await within(dialog).findByText('doit être après start_on')).toBeInTheDocument()
  expect(within(dialog).getByLabelText('Fin')).toHaveAccessibleDescription('doit être après start_on')
  expect(within(dialog).getByLabelText("Taille max. d'un effectif")).toHaveAccessibleDescription('doit être au moins 1')
})

const OVERLAP_MESSAGE = "Ces dates chevauchent une autre saison de la ligue. Une ligue n'a qu'une saison à la fois."
const overlap = () => HttpResponse.json({ error: 'season overlaps another season of the league' }, { status: 409 })

test('create: an overlapping season shows the message near the dates and keeps the form', async () => {
  server.use(http.post(`${API}/leagues/L1/seasons`, overlap))
  const { user } = setup()
  const dialog = await fillNew(user)
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  expect(await within(dialog).findByText(OVERLAP_MESSAGE)).toBeInTheDocument()
  expect(within(dialog).getByLabelText('Début')).toHaveValue('2027-09-01')
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
})

test('edit: an overlapping season shows the message near the dates', async () => {
  server.use(http.patch(`${API}/leagues/L1/seasons/S1`, overlap))
  const { user } = setup()
  const row = (await screen.findByRole('link', { name: '2026-2027' })).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Modifier' }))
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  expect(await within(dialog).findByText(OVERLAP_MESSAGE)).toBeInTheDocument()
})

test('a taken name shows the message under the name', async () => {
  server.use(
    http.post(`${API}/leagues/L1/seasons`, () => HttpResponse.json({ error: 'season name is already taken' }, { status: 409 })),
  )
  const { user } = setup()
  const dialog = await fillNew(user)
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  expect(await within(dialog).findByText('Ce nom est déjà pris dans la ligue.')).toBeInTheDocument()
  expect(within(dialog).getByLabelText('Nom')).toHaveAccessibleDescription('Ce nom est déjà pris dans la ligue.')
})

test('an unknown league answers 404 on the list, and the tab shows Introuvable.', async () => {
  mockLeague(leagueL1)
  server.use(http.get(`${API}/leagues/L1/seasons`, () => HttpResponse.json({ error: 'league not found' }, { status: 404 })))
  renderRoute('/leagues/L1?tab=seasons', { me: adminOne })
  expect(await screen.findByText('Introuvable.')).toBeInTheDocument()
})
