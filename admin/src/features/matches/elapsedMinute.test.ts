import { elapsedMinute } from '@/features/matches/elapsedMinute'

const kickoff = '2026-10-11T13:00:00Z'
const at = (minutes: number) => new Date(Date.parse(kickoff) + minutes * 60_000)

test.each([
  [-5, 1],
  [0, 1],
  [0.5, 1],
  [1, 2],
  [44.9, 45],
  [200, 150],
])('%s minutes after kickoff is minute %s', (minutes, expected) => {
  expect(elapsedMinute(kickoff, at(minutes))).toBe(expected)
})
