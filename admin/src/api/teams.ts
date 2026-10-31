import { omitEmpty } from '@/lib/form'
import { api, seg } from './client'
import type { Team, TeamInput, TeamPatch } from './types'

const base = (leagueId: string) => `/leagues/${seg(leagueId)}/teams`

export function listTeams(leagueId: string): Promise<Team[]> {
  return api<Team[]>('GET', base(leagueId))
}

export function createTeam(leagueId: string, input: TeamInput): Promise<Team> {
  return api<Team>('POST', base(leagueId), { body: input })
}

export function updateTeam(leagueId: string, teamId: string, input: TeamPatch): Promise<Team> {
  return api<Team>('PATCH', `${base(leagueId)}/${seg(teamId)}`, { body: omitEmpty(input) })
}

export function deleteTeam(leagueId: string, teamId: string): Promise<void> {
  return api('DELETE', `${base(leagueId)}/${seg(teamId)}`)
}
