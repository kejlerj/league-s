import { Ban, CalendarClock, Flag, Trash2 } from 'lucide-react'
import type { MatchStatus } from '@/api/types'
import { Ball } from '@/ui/icons'

export type StatusAction = 'start' | 'finish' | 'postpone' | 'cancel' | 'delete'

const ACTIONS: Record<MatchStatus, StatusAction[]> = {
  scheduled: ['start', 'postpone', 'cancel', 'delete'],
  live: ['finish', 'postpone', 'cancel'],
  postponed: ['cancel'],
  finished: [],
  cancelled: [],
}

export const ACTION_LABELS: Record<StatusAction, string> = {
  start: 'Démarrer',
  finish: 'Terminer',
  postpone: 'Reporter',
  cancel: 'Annuler',
  delete: 'Supprimer',
}

export const ACTION_ICONS = {
  start: Ball,
  finish: Flag,
  postpone: CalendarClock,
  cancel: Ban,
  delete: Trash2,
} satisfies Record<StatusAction, unknown>

export const STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Programmé',
  live: 'En cours',
  finished: 'Terminé',
  postponed: 'Reporté',
  cancelled: 'Annulé',
}

export function statusActions(status: MatchStatus): StatusAction[] {
  return ACTIONS[status]
}
