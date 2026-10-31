import { api, seg } from './client'
import type { StandingRow } from './types'

export function getStandings(leagueId: string, seasonId: string): Promise<StandingRow[]> {
  return api<StandingRow[]>('GET', `/leagues/${seg(leagueId)}/seasons/${seg(seasonId)}/standings`)
}
