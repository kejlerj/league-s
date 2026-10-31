import { omitEmpty } from '@/lib/form'
import { api, seg } from './client'
import type { Player, PlayerInput, PlayerPatch } from './types'

const base = (leagueId: string) => `/leagues/${seg(leagueId)}/players`

export function listPlayers(leagueId: string, q?: string): Promise<Player[]> {
  return api<Player[]>('GET', base(leagueId), { query: { q: q === '' ? undefined : q } })
}

export function createPlayer(leagueId: string, input: PlayerInput): Promise<Player> {
  return api<Player>('POST', base(leagueId), { body: input })
}

export function updatePlayer(leagueId: string, playerId: string, input: PlayerPatch): Promise<Player> {
  return api<Player>('PATCH', `${base(leagueId)}/${seg(playerId)}`, { body: omitEmpty(input) })
}

export function deletePlayer(leagueId: string, playerId: string): Promise<void> {
  return api('DELETE', `${base(leagueId)}/${seg(playerId)}`)
}
