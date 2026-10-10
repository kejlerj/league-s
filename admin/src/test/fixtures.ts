import { http, HttpResponse } from 'msw'
import type { League, Me } from '@/api/types'
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
  )
}
