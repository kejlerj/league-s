import { omitEmpty } from '@/lib/form'
import { api, seg } from './client'
import type { Match, MatchPatch, MatchStatus, ScheduleInput } from './types'

export type MatchFilters = { matchday?: string; status?: MatchStatus }

const base = (leagueId: string, seasonId: string) => `/leagues/${seg(leagueId)}/seasons/${seg(seasonId)}/matches`
const one = (leagueId: string, seasonId: string, matchId: string) => `${base(leagueId, seasonId)}/${seg(matchId)}`

export function listMatches(leagueId: string, seasonId: string, filters: MatchFilters): Promise<Match[]> {
  return api<Match[]>('GET', base(leagueId, seasonId), {
    query: { matchday: filters.matchday || undefined, status: filters.status },
  })
}

export function scheduleMatch(leagueId: string, seasonId: string, input: ScheduleInput): Promise<Match> {
  return api<Match>('POST', base(leagueId, seasonId), { body: input })
}

export function updateMatch(leagueId: string, seasonId: string, matchId: string, patch: MatchPatch): Promise<Match> {
  return api<Match>('PATCH', one(leagueId, seasonId, matchId), { body: omitEmpty(patch) })
}

export function deleteMatch(leagueId: string, seasonId: string, matchId: string): Promise<void> {
  return api('DELETE', one(leagueId, seasonId, matchId))
}

export function startMatch(leagueId: string, seasonId: string, matchId: string): Promise<unknown> {
  return api<unknown>('POST', `${one(leagueId, seasonId, matchId)}/start`)
}

export function setScore(leagueId: string, seasonId: string, matchId: string, home: number, away: number): Promise<unknown> {
  return api<unknown>('PUT', `${one(leagueId, seasonId, matchId)}/score`, { body: { home, away } })
}

export function finishMatch(leagueId: string, seasonId: string, matchId: string): Promise<unknown> {
  return api<unknown>('POST', `${one(leagueId, seasonId, matchId)}/finish`)
}

export function postponeMatch(leagueId: string, seasonId: string, matchId: string, kickoff_at: string | null): Promise<unknown> {
  return api<unknown>('POST', `${one(leagueId, seasonId, matchId)}/postpone`, { body: omitEmpty({ kickoff_at }) })
}

export function cancelMatch(leagueId: string, seasonId: string, matchId: string): Promise<unknown> {
  return api<unknown>('POST', `${one(leagueId, seasonId, matchId)}/cancel`)
}
