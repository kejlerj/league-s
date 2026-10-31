import { omitEmpty } from '@/lib/form'
import { api, seg } from './client'
import type { League } from './types'

export type LeagueInput = { name: string; logo: string | null }

export function listLeagues(): Promise<League[]> {
  return api<League[]>('GET', '/leagues')
}

export function getLeague(id: string): Promise<League> {
  return api<League>('GET', `/leagues/${seg(id)}`)
}

export function createLeague(input: LeagueInput): Promise<League> {
  return api<League>('POST', '/leagues', { body: input })
}

export function updateLeague(id: string, input: Partial<LeagueInput>): Promise<League> {
  return api<League>('PATCH', `/leagues/${seg(id)}`, { body: omitEmpty(input) })
}

export function deleteLeague(id: string): Promise<void> {
  return api('DELETE', `/leagues/${seg(id)}`)
}
