import type { Match } from '@/api/types'

export function newestFirst(a: Match, b: Match): number {
  if (a.kickoff_at !== b.kickoff_at) {
    if (a.kickoff_at === null) {
      return -1
    }
    if (b.kickoff_at === null) {
      return 1
    }
    return b.kickoff_at.localeCompare(a.kickoff_at)
  }
  if (a.matchday !== b.matchday) {
    return b.matchday - a.matchday
  }
  return b.id.localeCompare(a.id)
}
