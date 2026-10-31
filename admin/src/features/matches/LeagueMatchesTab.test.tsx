import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { Season } from '@/api/types'
import { adminOne, leagueL1, matchScheduled, mockLeague, seasonS1 } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'
import { currentSeason } from './LeagueMatchesTab'

const DAY = 24 * 60 * 60 * 1000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString()

const past: Season = { ...seasonS1, id: 'S0', name: 'Saison passée', start_on: iso(-400), end_on: iso(-100) }
const running: Season = { ...seasonS1, id: 'S1', name: 'Saison en cours', start_on: iso(-30), end_on: iso(200) }
const upcoming: Season = { ...seasonS1, id: 'S2', name: 'Saison à venir', start_on: iso(300), end_on: iso(600) }

function setup(seasons: Season[], requested: string[] = [], ...handlers: Parameters<typeof server.use>) {
  mockLeague(leagueL1)
  server.use(
    http.get(`${API}/leagues/L1/seasons`, () => HttpResponse.json(seasons)),
    http.get(`${API}/leagues/L1/seasons/:seasonId/matches`, ({ params }) => {
      requested.push(String(params.seasonId))
      return HttpResponse.json([{ ...matchScheduled, season_id: String(params.seasonId) }])
    }),
    http.get(`${API}/leagues/L1/seasons/:seasonId/teams`, () =>
      HttpResponse.json([
        { id: 'T1', name: 'AS Alpha', logo: null },
        { id: 'T2', name: 'FC Bravo', logo: null },
      ]),
    ),
    ...handlers,
  )
  return renderRoute('/leagues/L1', { me: adminOne })
}

test.each([
  ['la saison en cours', [past, running, upcoming], 'S1'],
  ['sinon la prochaine saison', [past, upcoming], 'S2'],
  ['sinon la dernière saison', [past], 'S0'],
])('currentSeason choisit %s', (_, seasons, expected) => {
  expect(currentSeason(seasons, new Date())?.id).toBe(expected)
})

test('currentSeason sans saison', () => {
  expect(currentSeason([], new Date())).toBeUndefined()
})

test("la page d'une ligue s'ouvre sur les matchs de la saison en cours", async () => {
  const requested: string[] = []
  setup([past, running, upcoming], requested)
  expect(await screen.findByRole('cell', { name: 'Programmé' })).toBeInTheDocument()
  expect(screen.getByLabelText('Saison')).toHaveValue('S1')
  expect(requested).toEqual(['S1'])
})

test('changer de saison recharge les matchs de la saison choisie', async () => {
  const requested: string[] = []
  const { user } = setup([past, running], requested)
  await screen.findByRole('cell', { name: 'Programmé' })
  await user.selectOptions(screen.getByLabelText('Saison'), 'S0')
  await vi.waitFor(() => expect(requested).toEqual(['S1', 'S0']))
  expect(screen.getByRole('link', { name: 'Équipes et classement de la saison' })).toHaveAttribute('href', '/leagues/L1/seasons/S0')
})

test("un admin de ligue programme un match depuis l'onglet Matchs de la ligue", async () => {
  let body: unknown
  const { user } = setup(
    [running],
    [],
    http.post(`${API}/leagues/L1/seasons/S1/matches`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(matchScheduled, { status: 201 })
    }),
  )
  await user.click(await screen.findByRole('button', { name: 'Programmer un match' }))
  const dialog = screen.getByRole('dialog')
  await vi.waitFor(() => expect(within(dialog).getAllByRole('option', { name: 'AS Alpha' })).toHaveLength(2))
  await user.selectOptions(within(dialog).getByLabelText('Domicile'), 'T1')
  await user.selectOptions(within(dialog).getByLabelText('Extérieur'), 'T2')
  await user.type(within(dialog).getByLabelText('Journée'), '3')
  await user.click(within(dialog).getByRole('button', { name: 'Programmer' }))
  await vi.waitFor(() => expect(body).toEqual({ home_team_id: 'T1', away_team_id: 'T2', matchday: 3, kickoff_at: null, venue: null }))
})

test("sans saison, l'onglet Matchs renvoie vers l'onglet Saisons", async () => {
  setup([])
  expect(await screen.findByText(/Aucune saison/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Saisons' })).toHaveAttribute('href', '/leagues/L1?tab=seasons')
})
