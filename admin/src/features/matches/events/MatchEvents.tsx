import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteEvent, listEvents } from '@/api/events'
import type { Match, MatchEvent, MatchEventType } from '@/api/types'
import { Button } from '@/ui/Button'
import { ConfirmDialog } from '@/ui/ConfirmDialog'
import { IconButton } from '@/ui/IconButton'
import { Modal } from '@/ui/Modal'
import { PageState } from '@/ui/PageState'
import { EventForm } from './EventForm'
import { EVENT_LABELS, EVENT_TYPES, eventDetail, eventTitle } from './eventLabels'

type Props = { leagueId: string; seasonId: string; match: Match; onChanged: () => Promise<void> }

const runningScore = (event: MatchEvent) =>
  event.home_score === null || event.away_score === null ? null : `${event.home_score} – ${event.away_score}`

export function MatchEvents({ leagueId, seasonId, match, onChanged }: Props) {
  const [recording, setRecording] = useState<MatchEventType | null>(null)
  const [deleting, setDeleting] = useState<MatchEvent | null>(null)
  const query = useQuery({
    queryKey: ['match', match.id, 'events'],
    queryFn: () => listEvents(leagueId, seasonId, match.id),
  })
  const teamName = (teamId: string) => (teamId === match.home_team.id ? match.home_team.name : match.away_team.name)

  return (
    <section aria-label="Faits de match" className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">Faits de match</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {EVENT_TYPES.map((type) => (
          <Button key={type} className="py-4 text-base sm:py-3 sm:text-sm" onClick={() => setRecording(type)}>
            {EVENT_LABELS[type]}
          </Button>
        ))}
      </div>
      <PageState query={query}>
        {(events) =>
          events.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">Aucun fait de match.</p>
          ) : (
            <ul aria-label="Faits de match" className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
              {[...events].reverse().map((event) => (
                <li key={event.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-10 shrink-0 font-semibold tabular-nums text-slate-900">{`${event.minute}'`}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-slate-900">{eventTitle(event)}</span>
                    {' · '}
                    <span className="text-slate-700">{eventDetail(event)}</span>
                    <span className="block text-xs text-slate-500">
                      {[teamName(event.team_id), runningScore(event)].filter((part) => part !== null).join(' · ')}
                    </span>
                  </span>
                  <IconButton label="Supprimer" icon={Trash2} danger onClick={() => setDeleting(event)} />
                </li>
              ))}
            </ul>
          )
        }
      </PageState>
      <Modal title={recording === null ? '' : EVENT_LABELS[recording]} open={recording !== null} onClose={() => setRecording(null)}>
        {recording !== null ? (
          <EventForm
            leagueId={leagueId}
            seasonId={seasonId}
            match={match}
            type={recording}
            onCancel={() => setRecording(null)}
            onDone={() => {
              setRecording(null)
              void onChanged()
            }}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer le fait de match"
        message={deleting === null ? '' : `${deleting.minute}' · ${eventTitle(deleting)} · ${eventDetail(deleting)}. Un but supprimé sur un match en cours retire aussi un but au score.`}
        confirmLabel="Supprimer"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting !== null) {
            await deleteEvent(leagueId, seasonId, match.id, deleting.id)
            await onChanged()
          }
        }}
      />
    </section>
  )
}
