import type { MatchStatus } from '@/api/types'
import { matchActions } from '@/features/matches/matchActions'

test.each([
  ['scheduled', ['start', 'reschedule', 'details', 'postpone', 'cancel', 'delete']],
  ['live', ['score', 'finish', 'details']],
  ['postponed', ['reschedule', 'details', 'cancel']],
  ['finished', ['details']],
  ['cancelled', []],
])('matchActions(%s)', (status, expected) => {
  expect(matchActions(status as MatchStatus)).toEqual(expected)
})
