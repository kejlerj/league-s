import { api, seg } from './client'
import type { SquadMember } from './types'

export type JoinInput = { player_id: string; number: number | null; joined_on: string }

export type TransferInput = {
  player_id: string
  from_team_id: string
  to_team_id: string
  number: number | null
  on: string
}

const season = (leagueId: string, seasonId: string) => `/leagues/${seg(leagueId)}/seasons/${seg(seasonId)}`
const squad = (leagueId: string, seasonId: string, teamId: string) =>
  `${season(leagueId, seasonId)}/teams/${seg(teamId)}/squad`

export function listSquad(leagueId: string, seasonId: string, teamId: string, all: boolean): Promise<SquadMember[]> {
  return api<SquadMember[]>('GET', squad(leagueId, seasonId, teamId), { query: { all: all ? 'true' : undefined } })
}

export function joinSquad(leagueId: string, seasonId: string, teamId: string, input: JoinInput): Promise<unknown> {
  return api<unknown>('POST', squad(leagueId, seasonId, teamId), { body: input })
}

export function changeNumber(
  leagueId: string,
  seasonId: string,
  teamId: string,
  membershipId: string,
  number: number | null,
): Promise<unknown> {
  return api<unknown>('PATCH', `${squad(leagueId, seasonId, teamId)}/${seg(membershipId)}`, { body: { number } })
}

export function leaveSquad(
  leagueId: string,
  seasonId: string,
  teamId: string,
  membershipId: string,
  left_on: string,
): Promise<unknown> {
  return api<unknown>('POST', `${squad(leagueId, seasonId, teamId)}/${seg(membershipId)}/leave`, { body: { left_on } })
}

export function transfer(leagueId: string, seasonId: string, input: TransferInput): Promise<unknown> {
  return api<unknown>('POST', `${season(leagueId, seasonId)}/transfers`, { body: input })
}
