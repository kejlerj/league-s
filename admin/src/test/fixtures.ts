import { http, HttpResponse } from 'msw'
import type { League, Match, Me, Player, Season, Team } from '@/api/types'
import { API, server } from './server'

export const leagueL1: League = { id: 'L1', name: 'District Nord', logo: null }
export const leagueL2: League = { id: 'L2', name: 'District Sud', logo: 'https://img.test/sud.png' }

export const superadmin: Me = {
  id: 'U0',
  email: 'root@ligue.test',
  name: 'Root',
  is_superadmin: true,
  leagues: [],
}

export const adminOne: Me = {
  id: 'U1',
  email: 'nord@ligue.test',
  name: 'Admin Nord',
  is_superadmin: false,
  leagues: [{ id: 'L1', name: 'District Nord' }],
}

export const adminTwo: Me = {
  id: 'U2',
  email: 'deux@ligue.test',
  name: 'Admin Deux',
  is_superadmin: false,
  leagues: [
    { id: 'L1', name: 'District Nord' },
    { id: 'L2', name: 'District Sud' },
  ],
}

export function mockMe(me: Me | null): void {
  server.use(
    http.get(`${API}/me`, () =>
      me === null
        ? HttpResponse.json({ error: 'authentication required' }, { status: 401 })
        : HttpResponse.json(me),
    ),
  )
}

export function mockLeague(league: League): void {
  server.use(
    http.get(`${API}/leagues/${league.id}`, () => HttpResponse.json(league)),
    http.get(`${API}/leagues/${league.id}/teams`, () => HttpResponse.json([])),
    http.get(`${API}/leagues/${league.id}/seasons`, () => HttpResponse.json([])),
  )
}

export const teamA: Team = { id: 'T1', league_id: 'L1', name: 'AS Alpha', logo: null }
export const teamB: Team = { id: 'T2', league_id: 'L1', name: 'FC Bravo', logo: 'https://img.test/bravo.png' }

export const playerP1: Player = { id: 'P1', league_id: 'L1', firstname: 'Léo', lastname: 'Dupont', icon: null }
export const playerP2: Player = { id: 'P2', league_id: 'L1', firstname: 'Max', lastname: 'Durand', icon: null }

export const seasonS1: Season = {
  id: 'S1',
  league_id: 'L1',
  name: '2026-2027',
  start_on: '2026-09-01',
  end_on: '2027-06-30',
  match_win_pts: 3,
  match_draw_pts: 1,
  match_loss_pts: 0,
  tie_breakers: ['goal_difference', 'goals_scored'],
  max_squad_size: null,
}

export function mockSeason(season: Season = seasonS1): void {
  const base = `${API}/leagues/${season.league_id}/seasons/${season.id}`
  server.use(
    http.get(base, () => HttpResponse.json(season)),
    http.get(`${base}/teams`, () => HttpResponse.json([])),
    http.get(`${base}/matches`, () => HttpResponse.json([])),
    http.get(`${base}/standings`, () => HttpResponse.json([])),
    http.get(`${API}/leagues/${season.league_id}/teams`, () => HttpResponse.json([])),
  )
}

const alpha = { id: 'T1', name: 'AS Alpha', logo: null }
const bravo = { id: 'T2', name: 'FC Bravo', logo: null }

export const matchScheduled: Match = {
  id: 'M1',
  season_id: 'S1',
  home_team: alpha,
  away_team: bravo,
  matchday: 1,
  kickoff_at: '2026-10-11T13:00:00Z',
  status: 'scheduled',
  home_score: null,
  away_score: null,
  venue: null,
  referee: null,
  convocation_at: null,
  video_url: null,
}

export const matchLive: Match = {
  ...matchScheduled,
  id: 'M2',
  home_team: bravo,
  away_team: alpha,
  status: 'live',
  home_score: 0,
  away_score: 0,
  venue: 'Stade Nord',
}
