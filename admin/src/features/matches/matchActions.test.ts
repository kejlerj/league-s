import type { MatchStatus } from '@/api/types'
import { matchActions } from '@/features/matches/matchActions'

test.each([
  ['scheduled', ['start', 'edit', 'postpone', 'cancel', 'delete']],
  ['live', ['score', 'finish', 'postpone', 'cancel', 'edit']],
  ['postponed', ['edit', 'cancel']],
  ['finished', ['edit']],
  ['cancelled', []],
])('matchActions(%s)', (status, expected) => {
  expect(matchActions(status as MatchStatus)).toEqual(expected)
})
