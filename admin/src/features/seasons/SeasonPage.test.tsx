import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { adminOne, leagueL1, mockLeague, mockSeason, teamA, teamB } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

const S = `${API}/leagues/L1/seasons/S1`
const registered = [{ id: 'T1', name: 'AS Alpha', logo: null }]

function setup(tab = 'teams', ...handlers: Parameters<typeof server.use>) {
  mockSeason()
  server.use(
    http.get(`${S}/teams`, () => HttpResponse.json(registered)),
    http.get(`${API}/leagues/L1/teams`, () => HttpResponse.json([teamA, teamB])),
    ...handlers,
  )
  return renderRoute(`/leagues/L1/seasons/S1?tab=${tab}`, { me: adminOne })
}

test('shows the season, the way back to the league and the three tabs', async () => {
  setup()
  expect(await screen.findByRole('heading', { name: '2026-2027' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Retour à la ligue' })).toHaveAttribute('href', '/leagues/L1?tab=seasons')
  for (const label of ['Équipes', 'Matchs', 'Classement']) {
    expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
  }
})

test('a registered team links to its squad', async () => {
  setup()
  expect(await screen.findByRole('link', { name: 'AS Alpha' })).toHaveAttribute(
    'href',
    '/leagues/L1/seasons/S1/teams/T1',
  )
})

test('the list offers only unregistered teams and registers the chosen one', async () => {
  let called = ''
  server.use(
    http.post(`${S}/teams/:teamId`, ({ params }) => {
      called = String(params.teamId)
      return HttpResponse.json({ message: 'team added to season' }, { status: 201 })
    }),
  )
  const { user } = setup()
  const select = await screen.findByLabelText('Inscrire une équipe')
  await vi.waitFor(() => expect(within(select).getByRole('option', { name: 'FC Bravo' })).toBeInTheDocument())
  expect(within(select).queryByRole('option', { name: 'AS Alpha' })).not.toBeInTheDocument()
  await user.selectOptions(select, 'T2')
  await user.click(screen.getByRole('button', { name: 'Inscrire' }))
  await vi.waitFor(() => expect(called).toBe('T2'))
})

test('unregistering a team: the API answers 204 with no body', async () => {
  let called = false
  server.use(
    http.delete(`${S}/teams/T1`, () => {
      called = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { user } = setup()
  const row = (await screen.findByRole('link', { name: 'AS Alpha' })).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Désinscrire' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Désinscrire' }))
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(called).toBe(true)
})

test('unregistering refused', async () => {
  server.use(http.delete(`${S}/teams/T1`, () => HttpResponse.json({ error: 'x' }, { status: 409 })))
  const { user } = setup()
  const row = (await screen.findByRole('link', { name: 'AS Alpha' })).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Désinscrire' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Désinscrire' }))
  expect(await screen.findByText('Cette équipe a des matchs dans la saison.')).toBeInTheDocument()
})

test('the standings show a full row', async () => {
  setup(
    'standings',
    http.get(`${S}/standings`, () =>
      HttpResponse.json([
        {
          rank: 1, team_id: 'T1', team_name: 'AS Alpha', played: 12, won: 8, drawn: 3, lost: 1,
          goals_for: 27, goals_against: 9, goal_difference: 18, points: 26,
        },
      ]),
    ),
  )
  const row = (await screen.findByText('AS Alpha')).closest('tr')!
  const cells = within(row).getAllByRole('cell').map((cell) => cell.textContent)
  expect(cells).toEqual(['1', 'AS Alpha', '12', '8', '3', '1', '27', '9', '+18', '26'])
  const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
  expect(headers).toEqual(['#', 'Équipe', 'J', 'G', 'N', 'P', 'BP', 'BC', 'Diff', 'Pts'])
})

test('empty standings', async () => {
  setup('standings')
  expect(await screen.findByText('Aucun match terminé.')).toBeInTheDocument()
})

test('a season of a league they do not administer sends the admin back to their league', async () => {
  mockLeague(leagueL1)
  renderRoute('/leagues/L2/seasons/S9', { me: adminOne })
  expect(await screen.findByRole('heading', { name: 'District Nord' })).toBeInTheDocument()
})

test('when every team is registered, the tab explains where to create one', async () => {
  setup()
  server.use(http.get(`${API}/leagues/L1/teams`, () => HttpResponse.json([teamA])))
  expect(await screen.findByText(/Toutes les équipes de la ligue sont déjà inscrites/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Équipes' })).toHaveAttribute('href', '/leagues/L1?tab=teams')
})
