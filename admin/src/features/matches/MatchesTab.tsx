import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { listMatches } from '@/api/matches'
import { listSeasonTeams } from '@/api/seasons'
import type { Match, MatchStatus } from '@/api/types'
import { formatDateTime } from '@/lib/dates'
import { useDebounced } from '@/lib/useDebounced'
import { Button } from '@/ui/Button'
import { DataTable, type Column } from '@/ui/DataTable'
import { Field, SelectField } from '@/ui/Field'
import { Modal } from '@/ui/Modal'
import { PageState } from '@/ui/PageState'
import { TeamName } from '@/ui/TeamLogo'
import { STATUS_LABELS } from './matchActions'
import { newestFirst } from './matchOrder'
import { ScheduleForm } from './MatchForm'

const STATUSES = Object.keys(STATUS_LABELS) as MatchStatus[]

const score = (match: Match) =>
  match.home_score === null || match.away_score === null ? '–' : `${match.home_score} – ${match.away_score}`

export function MatchesTab({ leagueId, seasonId }: { leagueId: string; seasonId: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [matchdayInput, setMatchdayInput] = useState('')
  const [status, setStatus] = useState<MatchStatus | ''>('')
  const [scheduling, setScheduling] = useState(false)
  const matchday = useDebounced(matchdayInput.trim(), 300)
  const matches = useQuery({
    queryKey: ['season', seasonId, 'matches', matchday, status],
    queryFn: () => listMatches(leagueId, seasonId, { matchday, status: status === '' ? undefined : status }),
    placeholderData: (previous) => previous,
  })
  const teams = useQuery({ queryKey: ['season', seasonId, 'teams'], queryFn: () => listSeasonTeams(leagueId, seasonId) })

  const pageOf = (match: Match) => `/leagues/${leagueId}/seasons/${seasonId}/matches/${match.id}`

  const columns: Column<Match>[] = [
    { header: 'J', width: '3rem', cell: (match) => match.matchday },
    { header: 'Date', width: '9rem', cell: (match) => formatDateTime(match.kickoff_at) },
    { header: 'Domicile', cell: (match) => <TeamName team={match.home_team} />, title: (match) => match.home_team.name },
    {
      header: 'Score',
      width: '4.5rem',
      cell: (match) => (
        <Link
          to={pageOf(match)}
          aria-label={`Ouvrir le match ${match.home_team.name} – ${match.away_team.name}`}
          className="whitespace-nowrap text-emerald-800 underline-offset-2 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {score(match)}
        </Link>
      ),
    },
    { header: 'Extérieur', cell: (match) => <TeamName team={match.away_team} />, title: (match) => match.away_team.name },
    { header: 'Statut', width: '6rem', cell: (match) => STATUS_LABELS[match.status] },
  ]

  const onScheduled = (match: Match) => {
    setScheduling(false)
    void queryClient.invalidateQueries({ queryKey: ['season', seasonId, 'matches'] })
    navigate(pageOf(match))
  }

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
            rows={[...rows].sort(newestFirst)}
            columns={columns}
            rowKey={(match) => match.id}
            empty="Aucun match."
            onRowClick={(match) => navigate(pageOf(match))}
          />
        )}
      </PageState>
      <Modal title="Programmer un match" open={scheduling} onClose={() => setScheduling(false)}>
        <ScheduleForm
          leagueId={leagueId}
          seasonId={seasonId}
          teams={teams.data ?? []}
          onScheduled={onScheduled}
          onCancel={() => setScheduling(false)}
        />
      </Modal>
    </div>
  )
}
