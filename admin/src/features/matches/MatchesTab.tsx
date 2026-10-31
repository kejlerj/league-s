import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { cancelMatch, deleteMatch, finishMatch, listMatches, startMatch } from '@/api/matches'
import { listSeasonTeams } from '@/api/seasons'
import type { Match, MatchStatus } from '@/api/types'
import { formatDateTime } from '@/lib/dates'
import { useDebounced } from '@/lib/useDebounced'
import { Button } from '@/ui/Button'
import { ConfirmDialog } from '@/ui/ConfirmDialog'
import { DataTable, type Column } from '@/ui/DataTable'
import { Field, SelectField } from '@/ui/Field'
import { Modal } from '@/ui/Modal'
import { PageState } from '@/ui/PageState'
import { ACTION_LABELS, matchActions, STATUS_LABELS, type MatchAction } from './matchActions'
import { EditForm, PostponeForm, ScheduleForm } from './MatchForm'
import { ScoreForm } from './ScoreForm'

type Pending = { action: MatchAction; match: Match }
type ConfirmAction = 'start' | 'finish' | 'cancel' | 'delete'

const STATUSES = Object.keys(STATUS_LABELS) as MatchStatus[]

const FORM_TITLES: Partial<Record<MatchAction, string>> = {
  score: 'Score',
  edit: 'Modifier le match',
  postpone: 'Reporter le match',
}

const CONFIRMS: Record<ConfirmAction, { title: string; message: string; label: string; danger: boolean }> = {
  start: { title: 'Démarrer le match', message: 'Le match passe en cours avec un score de 0 – 0.', label: 'Démarrer', danger: false },
  finish: { title: 'Terminer le match', message: 'Le score devient définitif et compte au classement.', label: 'Terminer', danger: false },
  cancel: {
    title: 'Annuler le match',
    message: 'Un match annulé ne peut plus être joué ni reprogrammé. Un match en cours garde son score, qui ne compte pas au classement.',
    label: 'Annuler le match',
    danger: true,
  },
  delete: { title: 'Supprimer le match', message: 'Le match est retiré du calendrier.', label: 'Supprimer', danger: true },
}

const describe = (match: Match) => `${match.home_team.name} – ${match.away_team.name}, journée ${match.matchday}`

const isConfirm = (action: MatchAction): action is ConfirmAction => action in CONFIRMS

const score = (match: Match) =>
  match.home_score === null || match.away_score === null ? '–' : `${match.home_score} – ${match.away_score}`

function byMatchdayThenKickoff(a: Match, b: Match): number {
  if (a.matchday !== b.matchday) {
    return a.matchday - b.matchday
  }
  return (a.kickoff_at ?? '9999').localeCompare(b.kickoff_at ?? '9999')
}

export function MatchesTab({ leagueId, seasonId }: { leagueId: string; seasonId: string }) {
  const queryClient = useQueryClient()
  const [matchdayInput, setMatchdayInput] = useState('')
  const [status, setStatus] = useState<MatchStatus | ''>('')
  const [scheduling, setScheduling] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const matchday = useDebounced(matchdayInput.trim(), 300)
  const matches = useQuery({
    queryKey: ['season', seasonId, 'matches', matchday, status],
    queryFn: () => listMatches(leagueId, seasonId, { matchday, status: status === '' ? undefined : status }),
    placeholderData: (previous) => previous,
  })
  const teams = useQuery({ queryKey: ['season', seasonId, 'teams'], queryFn: () => listSeasonTeams(leagueId, seasonId) })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['season', seasonId, 'matches'] }),
      queryClient.invalidateQueries({ queryKey: ['season', seasonId, 'standings'] }),
    ])
  }
  const close = () => setPending(null)
  const done = () => {
    close()
    setScheduling(false)
    void refresh()
  }

  const run = (action: ConfirmAction, match: Match): Promise<unknown> => {
    const calls: Record<ConfirmAction, () => Promise<unknown>> = {
      start: () => startMatch(leagueId, seasonId, match.id),
      finish: () => finishMatch(leagueId, seasonId, match.id),
      cancel: () => cancelMatch(leagueId, seasonId, match.id),
      delete: () => deleteMatch(leagueId, seasonId, match.id),
    }
    return calls[action]()
  }

  const columns: Column<Match>[] = [
    { header: 'J', cell: (match) => match.matchday },
    { header: 'Date', cell: (match) => formatDateTime(match.kickoff_at) },
    { header: 'Domicile', cell: (match) => match.home_team.name },
    { header: 'Score', cell: (match) => <span className="whitespace-nowrap">{score(match)}</span> },
    { header: 'Extérieur', cell: (match) => match.away_team.name },
    { header: 'Statut', cell: (match) => STATUS_LABELS[match.status] },
    {
      header: '',
      align: 'right',
      cell: (match) => (
        <span className="whitespace-nowrap">
          {matchActions(match.status).map((action) => (
            <Button key={action} variant="link" onClick={() => setPending({ action, match })}>
              {ACTION_LABELS[action]}
            </Button>
          ))}
        </span>
      ),
    },
  ]

  const confirm = pending !== null && isConfirm(pending.action) ? { ...CONFIRMS[pending.action], action: pending.action } : null
  const formTitle = pending !== null ? FORM_TITLES[pending.action] : undefined
  const common = { leagueId, seasonId, onDone: done, onCancel: close }

  return (
    <div>
      <div className="mb-3 flex items-end gap-3">
        <Field
          label="Journée"
          type="number"
          min={1}
          className="w-28"
          value={matchdayInput}
          onChange={(e) => setMatchdayInput(e.target.value)}
        />
        <SelectField label="Statut" className="w-44" value={status} onChange={(e) => setStatus(e.target.value as MatchStatus | '')}>
          <option value="">Tous</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {STATUS_LABELS[item]}
            </option>
          ))}
        </SelectField>
        <Button variant="primary" className="ml-auto" onClick={() => setScheduling(true)}>
          Programmer un match
        </Button>
      </div>
      <PageState query={matches}>
        {(rows) => (
          <DataTable
            rows={[...rows].sort(byMatchdayThenKickoff)}
            columns={columns}
            rowKey={(match) => match.id}
            empty="Aucun match."
          />
        )}
      </PageState>
      <Modal title="Programmer un match" open={scheduling} onClose={() => setScheduling(false)}>
        <ScheduleForm {...common} teams={teams.data ?? []} onCancel={() => setScheduling(false)} />
      </Modal>
      <Modal title={formTitle ?? ''} open={formTitle !== undefined} onClose={close}>
        {pending !== null ? <p className="mb-4 text-sm text-slate-600">{describe(pending.match)}</p> : null}
        {pending?.action === 'score' ? <ScoreForm {...common} match={pending.match} /> : null}
        {pending?.action === 'edit' ? <EditForm {...common} match={pending.match} /> : null}
        {pending?.action === 'postpone' ? <PostponeForm {...common} match={pending.match} /> : null}
      </Modal>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm !== null && pending !== null ? `${describe(pending.match)}. ${confirm.message}` : ''}
        confirmLabel={confirm?.label ?? ''}
        danger={confirm?.danger ?? false}
        onClose={close}
        onConfirm={async () => {
          if (pending !== null && confirm !== null) {
            await run(confirm.action, pending.match)
            await refresh()
          }
        }}
      />
    </div>
  )
}
