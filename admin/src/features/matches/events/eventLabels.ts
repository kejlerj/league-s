import type { MatchEvent, MatchEventPlayer, MatchEventType } from '@/api/types'

export const EVENT_TYPES: MatchEventType[] = ['goal', 'yellow_card', 'red_card', 'substitution', 'injury']

export const EVENT_LABELS: Record<MatchEventType, string> = {
  goal: 'But',
  yellow_card: 'Carton jaune',
  red_card: 'Carton rouge',
  substitution: 'Remplacement',
  injury: 'Blessure',
}

const CONFLICTS: Record<string, string> = {
  'match is not live or finished': "Le match n'est ni en cours ni terminé.",
  'player is already sent off': 'Ce joueur est déjà exclu.',
  'team already has as many goal events as goals': "Tous les buts de cette équipe sont déjà saisis. Corrigez d'abord le score.",
}

export function conflictMessage(message: string): string | undefined {
  return CONFLICTS[message]
}

export const nameOf = (player: MatchEventPlayer) => `${player.firstname} ${player.lastname}`

export function eventTitle(event: MatchEvent): string {
  if (event.type === 'goal') {
    if (event.own_goal) {
      return 'But contre son camp'
    }
    return event.penalty ? 'But · Penalty' : 'But'
  }
  if (event.type === 'yellow_card' && event.sent_off) {
    return '2e jaune'
  }
  return EVENT_LABELS[event.type]
}

export function eventDetail(event: MatchEvent): string {
  switch (event.type) {
    case 'goal': {
      const scorer = event.player === null ? 'Buteur inconnu' : nameOf(event.player)
      return event.assist_player === null ? scorer : `${scorer}, passe de ${nameOf(event.assist_player)}`
    }
    case 'substitution':
      return `Sort : ${event.player === null ? '—' : nameOf(event.player)}, entre : ${event.player_in === null ? '—' : nameOf(event.player_in)}`
    case 'injury':
      return [event.player === null ? '—' : nameOf(event.player), event.note].filter((part) => part !== null).join(' · ')
    default:
      return event.player === null ? '—' : nameOf(event.player)
  }
}
