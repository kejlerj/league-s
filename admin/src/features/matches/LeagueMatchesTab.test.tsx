import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { Season } from '@/api/types'
import { adminOne, leagueL1, matchScheduled, mockLeague, seasonS1 } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'
import { currentSeason } from './LeagueMatchesTab'

const TODAY = '2026-11-15'

const past: Season = { ...seasonS1, id: 'S0', name: 'Saison passée', start_on: '2025-09-01', end_on: '2026-06-30' }
const running: Season = { ...seasonS1, id: 'S1', name: 'Saison en cours', start_on: '2026-09-01', end_on: '2027-06-30' }
const upcoming: Season = { ...seasonS1, id: 'S2', name: 'Saison à venir', start_on: '2027-09-01', end_on: '2028-06-30' }

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
  ['the current season', [past, running, upcoming], 'S1'],
  ['otherwise the next season', [past, upcoming], 'S2'],
  ['otherwise the last season', [past], 'S0'],
])('currentSeason picks %s', (_, seasons, expected) => {
  expect(currentSeason(seasons, TODAY)?.id).toBe(expected)
})

test('currentSeason counts the first and the last day of a season', () => {
  expect(currentSeason([past, running, upcoming], '2026-09-01')?.id).toBe('S1')
  expect(currentSeason([past, running, upcoming], '2027-06-30')?.id).toBe('S1')
  expect(currentSeason([past, running, upcoming], '2027-07-01')?.id).toBe('S2')
})

test('currentSeason without a season', () => {
  expect(currentSeason([], TODAY)).toBeUndefined()
})

test('a league page opens on the matches of the current season', async () => {
  const requested: string[] = []
  setup([past, running, upcoming], requested)
  expect(await screen.findByRole('cell', { name: 'Programmé' })).toBeInTheDocument()
  expect(screen.getByLabelText('Saison')).toHaveValue('S1')
  expect(requested).toEqual(['S1'])
})

test('changing season loads the matches of the chosen season', async () => {
  const requested: string[] = []
  const { user } = setup([past, running], requested)
  await screen.findByRole('cell', { name: 'Programmé' })
  await user.selectOptions(screen.getByLabelText('Saison'), 'S0')
  await vi.waitFor(() => expect(requested).toEqual(['S1', 'S0']))
  expect(screen.getByRole('link', { name: 'Équipes et classement de la saison' })).toHaveAttribute('href', '/leagues/L1/seasons/S0')
})

test("a league admin schedules a match from the league's Matches tab", async () => {
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

test('without a season, the Matches tab points to the Seasons tab', async () => {
  setup([])
  expect(await screen.findByText(/Aucune saison/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Saisons' })).toHaveAttribute('href', '/leagues/L1?tab=seasons')
})
