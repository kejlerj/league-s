import { api, seg } from './client'
import type { Season, SeasonInput, SeasonPatch, SeasonTeam } from './types'

const base = (leagueId: string) => `/leagues/${seg(leagueId)}/seasons`
const one = (leagueId: string, seasonId: string) => `${base(leagueId)}/${seg(seasonId)}`

export function listSeasons(leagueId: string): Promise<Season[]> {
  return api<Season[]>('GET', base(leagueId))
}

export function getSeason(leagueId: string, seasonId: string): Promise<Season> {
  return api<Season>('GET', one(leagueId, seasonId))
}

export function createSeason(leagueId: string, input: SeasonInput): Promise<Season> {
  return api<Season>('POST', base(leagueId), { body: input })
}

export function updateSeason(leagueId: string, seasonId: string, input: SeasonPatch): Promise<Season> {
  return api<Season>('PATCH', one(leagueId, seasonId), { body: input })
}

export function deleteSeason(leagueId: string, seasonId: string): Promise<void> {
  return api('DELETE', one(leagueId, seasonId))
}

export function listSeasonTeams(leagueId: string, seasonId: string): Promise<SeasonTeam[]> {
  return api<SeasonTeam[]>('GET', `${one(leagueId, seasonId)}/teams`)
}

export function addSeasonTeam(leagueId: string, seasonId: string, teamId: string): Promise<void> {
  return api('POST', `${one(leagueId, seasonId)}/teams/${seg(teamId)}`)
}

export function removeSeasonTeam(leagueId: string, seasonId: string, teamId: string): Promise<void> {
  return api('DELETE', `${one(leagueId, seasonId)}/teams/${seg(teamId)}`)
}
