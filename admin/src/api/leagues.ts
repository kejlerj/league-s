import { omitEmpty } from '@/lib/form'
import { api, seg } from './client'
import type { League, LeagueInput, LeaguePatch } from './types'

export function listLeagues(): Promise<League[]> {
  return api<League[]>('GET', '/leagues')
}

export function getLeague(id: string): Promise<League> {
  return api<League>('GET', `/leagues/${seg(id)}`)
}

export function createLeague(input: LeagueInput): Promise<League> {
  return api<League>('POST', '/leagues', { body: input })
}

export function updateLeague(id: string, input: LeaguePatch): Promise<League> {
  return api<League>('PATCH', `/leagues/${seg(id)}`, { body: omitEmpty(input) })
}

export function deleteLeague(id: string): Promise<void> {
  return api('DELETE', `/leagues/${seg(id)}`)
}
