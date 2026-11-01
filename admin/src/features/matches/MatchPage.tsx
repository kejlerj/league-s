import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { cancelMatch, deleteMatch, finishMatch, getMatch, startMatch } from '@/api/matches'
import type { Match } from '@/api/types'
import { formatDateTime } from '@/lib/dates'
import { Button } from '@/ui/Button'
import { ConfirmDialog } from '@/ui/ConfirmDialog'
import { FormError } from '@/ui/Field'
import { Scoreboard } from '@/ui/icons'
import { Modal } from '@/ui/Modal'
import { PageState } from '@/ui/PageState'
import { TeamLogo } from '@/ui/TeamLogo'
import { useSubmit } from '@/ui/useSubmit'
import { elapsedMinute } from './elapsedMinute'
import { ACTION_ICONS, ACTION_LABELS, STATUS_LABELS, statusActions, type StatusAction } from './matchActions'
import { EditForm, PostponeForm } from './MatchForm'
import { ScoreForm } from './ScoreForm'

type Confirmed = 'finish' | 'cancel' | 'delete'
type Dialog = Confirmed | 'postpone' | 'edit' | 'score'

const CONFIRMS: Record<Confirmed, { title: string; message: string; label: string; danger: boolean }> = {
  finish: { title: 'Terminer le match', message: 'Le score devient définitif et compte au classement.', label: 'Terminer', danger: false },
  cancel: {
    title: 'Annuler le match',
    message: 'Un match annulé ne peut plus être joué ni reprogrammé. Un match en cours garde son score, qui ne compte pas au classement.',
    label: 'Annuler le match',
    danger: true,
  },
  delete: { title: 'Supprimer le match', message: 'Le match est retiré du calendrier.', label: 'Supprimer', danger: true },
}

const FORM_TITLES: Record<'postpone' | 'edit' | 'score', string> = {
  postpone: 'Reporter le match',
  edit: 'Modifier le match',
  score: 'Corriger le score',
}

const isConfirmed = (dialog: Dialog | null): dialog is Confirmed => dialog !== null && dialog in CONFIRMS

const scoreOf = (match: Match) =>
  match.home_score === null || match.away_score === null ? '–' : `${match.home_score} – ${match.away_score}`

function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) {
      return
    }
    const timer = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

function HeaderTeam({ team }: { team: Match['home_team'] }) {
  return (
    <span className="flex min-w-0 flex-col items-center gap-1 text-center text-sm font-medium break-words text-slate-900 sm:text-base">
      <TeamLogo team={team} />
      <span className="max-w-full">{team.name}</span>
    </span>
  )
}

function MatchHeader({ match }: { match: Match }) {
  const live = match.status === 'live' && match.kickoff_at !== null
  const now = useNow(live)
  const details = [`Journée ${match.matchday}`, formatDateTime(match.kickoff_at), match.venue].filter((item) => item !== null)

  return (
    <section aria-label="Match" className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">{details.join(' · ')}</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <HeaderTeam team={match.home_team} />
        <span className="whitespace-nowrap text-3xl font-semibold tabular-nums text-slate-900 sm:text-4xl">{scoreOf(match)}</span>
        <HeaderTeam team={match.away_team} />
      </div>
      <p className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
        <span>{STATUS_LABELS[match.status]}</span>
        {live && match.kickoff_at !== null ? <span className="text-emerald-800">{`${elapsedMinute(match.kickoff_at, now)}'`}</span> : null}
      </p>
    </section>
  )
}

export function MatchPage() {
  const { leagueId = '', seasonId = '', matchId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const query = useQuery({ queryKey: ['match', matchId], queryFn: () => getMatch(leagueId, seasonId, matchId) })
  const matchesUrl = `/leagues/${leagueId}/seasons/${seasonId}?tab=matches`
  const start = useSubmit(() => startMatch(leagueId, seasonId, matchId))

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['match', matchId] }),
      queryClient.invalidateQueries({ queryKey: ['season', seasonId, 'matches'] }),
      queryClient.invalidateQueries({ queryKey: ['season', seasonId, 'standings'] }),
    ])
  }
  const close = () => setDialog(null)
  const done = () => {
    close()
    void refresh()
  }

  const onAction = async (action: StatusAction) => {
    if (action === 'start') {
      if (await start.submit()) {
        await refresh()
      }
      return
    }
    setDialog(action)
  }

  const runConfirmed = async (action: Confirmed) => {
    const calls: Record<Confirmed, () => Promise<unknown>> = {
      finish: () => finishMatch(leagueId, seasonId, matchId),
      cancel: () => cancelMatch(leagueId, seasonId, matchId),
      delete: () => deleteMatch(leagueId, seasonId, matchId),
    }
    await calls[action]()
    if (action === 'delete') {
      await queryClient.invalidateQueries({ queryKey: ['season', seasonId, 'matches'] })
      navigate(matchesUrl)
      return
    }
    await refresh()
  }

  const confirm = isConfirmed(dialog) ? CONFIRMS[dialog] : null
  const formDialog = dialog === 'postpone' || dialog === 'edit' || dialog === 'score' ? dialog : null

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={matchesUrl} className="text-sm text-emerald-800 underline-offset-2 hover:underline">
        Retour aux matchs
      </Link>
      <PageState query={query}>
        {(match) => {
          const common = { leagueId, seasonId, match, onDone: done, onCancel: close }
          const actions = statusActions(match.status)
          const canScore = match.status === 'live' || match.status === 'finished'
          return (
            <div className="mt-3 space-y-4">
              <MatchHeader match={match} />
              {actions.length > 0 ? (
                <div role="group" aria-label="Statut du match" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {actions.map((action) => {
                    const Icon = ACTION_ICONS[action]
                    const danger = action === 'cancel' || action === 'delete'
                    return (
                      <Button
                        key={action}
                        variant={action === 'start' || action === 'finish' ? 'primary' : danger ? 'danger' : 'secondary'}
                        pending={action === 'start' && start.pending}
                        className="inline-flex items-center justify-center gap-2 py-3 sm:py-2"
                        onClick={() => void onAction(action)}
                      >
                        <Icon size={18} aria-hidden="true" />
                        {ACTION_LABELS[action]}
                      </Button>
                    )
                  })}
                </div>
              ) : null}
              <FormError message={start.error} />
              <div className="flex flex-wrap gap-2">
                <Button className="inline-flex items-center gap-2" onClick={() => setDialog('edit')}>
                  <Pencil size={18} aria-hidden="true" />
                  Modifier
                </Button>
                {canScore ? (
                  <Button className="inline-flex items-center gap-2" onClick={() => setDialog('score')}>
                    <Scoreboard size={18} aria-hidden="true" />
                    Corriger le score
                  </Button>
                ) : null}
              </div>
              <Modal title={formDialog === null ? '' : FORM_TITLES[formDialog]} open={formDialog !== null} onClose={close}>
                {formDialog === 'postpone' ? <PostponeForm {...common} /> : null}
                {formDialog === 'edit' ? <EditForm {...common} /> : null}
                {formDialog === 'score' ? <ScoreForm {...common} /> : null}
              </Modal>
              <ConfirmDialog
                open={confirm !== null}
                title={confirm?.title ?? ''}
                message={confirm?.message ?? ''}
                confirmLabel={confirm?.label ?? ''}
                danger={confirm?.danger ?? false}
                onClose={close}
                onConfirm={async () => {
                  if (isConfirmed(dialog)) {
                    await runConfirmed(dialog)
                  }
                }}
              />
            </div>
          )
        }}
      </PageState>
    </div>
  )
}
