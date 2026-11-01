import type { Match } from '@/api/types'
import { newestFirst } from '@/features/matches/matchOrder'
import { matchScheduled } from '@/test/fixtures'

const match = (id: string, matchday: number, kickoff_at: string | null): Match => ({ ...matchScheduled, id, matchday, kickoff_at })

const order = (matches: Match[]) => [...matches].sort(newestFirst).map((m) => m.id)

test('the latest kickoff comes first', () => {
  expect(order([match('a', 1, '2026-09-05T14:00:00Z'), match('b', 3, '2026-09-19T14:00:00Z'), match('c', 2, '2026-09-12T14:00:00Z')])).toEqual([
    'b',
    'c',
    'a',
  ])
})

test('matches without a kickoff come first, highest matchday first', () => {
  expect(order([match('a', 1, '2026-09-05T14:00:00Z'), match('b', 2, null), match('c', 5, null)])).toEqual(['c', 'b', 'a'])
})

test('on the same kickoff the highest matchday comes first', () => {
  expect(order([match('a', 1, '2026-09-05T14:00:00Z'), match('b', 2, '2026-09-05T14:00:00Z')])).toEqual(['b', 'a'])
})

test('full ties keep a stable order by id', () => {
  const kickoff = '2026-09-05T14:00:00Z'
  expect(order([match('M1', 1, kickoff), match('M3', 1, kickoff), match('M2', 1, kickoff)])).toEqual(['M3', 'M2', 'M1'])
})
