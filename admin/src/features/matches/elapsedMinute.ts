const FIRST = 1
const LAST = 150

export function elapsedMinute(kickoffAt: string, now: Date): number {
  const minute = Math.floor((now.getTime() - Date.parse(kickoffAt)) / 60_000) + 1
  return Math.min(LAST, Math.max(FIRST, minute))
}
