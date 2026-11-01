import type { MatchStatus } from '@/api/types'
import { statusActions } from '@/features/matches/matchActions'

test.each([
  ['scheduled', ['start', 'postpone', 'cancel', 'delete']],
  ['live', ['finish', 'postpone', 'cancel']],
  ['postponed', ['cancel']],
  ['finished', []],
  ['cancelled', []],
])('statusActions(%s)', (status, expected) => {
  expect(statusActions(status as MatchStatus)).toEqual(expected)
})
