import type { MatchStatus } from '@/api/types'

export type MatchAction = 'start' | 'score' | 'finish' | 'postpone' | 'cancel' | 'reschedule' | 'details' | 'delete'

const ACTIONS: Record<MatchStatus, MatchAction[]> = {
  scheduled: ['start', 'reschedule', 'details', 'postpone', 'cancel', 'delete'],
  live: ['score', 'finish', 'details'],
  postponed: ['reschedule', 'details', 'cancel'],
  finished: ['details'],
  cancelled: [],
}

export const ACTION_LABELS: Record<MatchAction, string> = {
  start: 'Démarrer',
  score: 'Score',
  finish: 'Terminer',
  postpone: 'Reporter',
  cancel: 'Annuler',
  reschedule: 'Reprogrammer',
  details: 'Détails',
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
