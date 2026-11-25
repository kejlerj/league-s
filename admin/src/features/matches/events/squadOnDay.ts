import type { SquadMember } from '@/api/types'

export function matchDay(kickoffAt: string | null, now: Date): string {
  return (kickoffAt === null ? now.toISOString() : new Date(kickoffAt).toISOString()).slice(0, 10)
}

const byNumberThenName = (a: SquadMember, b: SquadMember) => {
  if (a.number !== b.number) {
    if (a.number === null) {
      return 1
    }
    if (b.number === null) {
      return -1
    }
    return a.number - b.number
  }
  return a.lastname.localeCompare(b.lastname, 'fr') || a.firstname.localeCompare(b.firstname, 'fr')
}

export function squadOnDay(members: SquadMember[], day: string): SquadMember[] {
  return members
    .filter((member) => member.joined_on <= day && (member.left_on === null || member.left_on >= day))
    .sort(byNumberThenName)
}

export function memberLabel(member: SquadMember): string {
  const name = `${member.firstname} ${member.lastname}`
  return member.number === null ? name : `${member.number} · ${name}`
}
