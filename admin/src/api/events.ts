import { api, seg } from './client'
import type { EventInput, MatchEvent } from './types'

const events = (leagueId: string, seasonId: string, matchId: string) =>
  `/leagues/${seg(leagueId)}/seasons/${seg(seasonId)}/matches/${seg(matchId)}/events`

export function listEvents(leagueId: string, seasonId: string, matchId: string): Promise<MatchEvent[]> {
  return api<MatchEvent[]>('GET', events(leagueId, seasonId, matchId))
}

export function recordEvent(leagueId: string, seasonId: string, matchId: string, input: EventInput): Promise<MatchEvent> {
  return api<MatchEvent>('POST', events(leagueId, seasonId, matchId), { body: input })
}

export function deleteEvent(leagueId: string, seasonId: string, matchId: string, eventId: string): Promise<void> {
  return api('DELETE', `${events(leagueId, seasonId, matchId)}/${seg(eventId)}`)
}
