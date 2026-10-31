import type { MatchStatus } from '@/api/types'

export type MatchAction = 'start' | 'score' | 'finish' | 'postpone' | 'cancel' | 'edit' | 'delete'

const ACTIONS: Record<MatchStatus, MatchAction[]> = {
  scheduled: ['start', 'edit', 'postpone', 'cancel', 'delete'],
  live: ['score', 'finish', 'edit'],
  postponed: ['edit', 'cancel'],
  finished: ['edit'],
  cancelled: [],
}

export const ACTION_LABELS: Record<MatchAction, string> = {
  start: 'Démarrer',
  score: 'Score',
  finish: 'Terminer',
  postpone: 'Reporter',
  cancel: 'Annuler',
  edit: 'Modifier',
  delete: 'Supprimer',
}

export const STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Programmé',
  live: 'En cours',
  finished: 'Terminé',
  postponed: 'Reporté',
  cancelled: 'Annulé',
}

export function matchActions(status: MatchStatus): MatchAction[] {
  return ACTIONS[status]
}
