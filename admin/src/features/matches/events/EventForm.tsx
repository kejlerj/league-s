import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '@/api/client'
import { recordEvent } from '@/api/events'
import { listSquad } from '@/api/squad'
import type { EventInput, Match, MatchEventType, SquadMember } from '@/api/types'
import { emptyToNull, toInt } from '@/lib/form'
import { Field, SelectField } from '@/ui/Field'
import { FormActions } from '@/ui/FormActions'
import { useSubmit } from '@/ui/useSubmit'
import { elapsedMinute } from '../elapsedMinute'
import { conflictMessage } from './eventLabels'
import { matchDay, memberLabel, squadOnDay } from './squadOnDay'

type Props = {
  leagueId: string
  seasonId: string
  match: Match
  type: MatchEventType
  onDone: () => void
  onCancel: () => void
}

const NO_TEAM = "Choisissez l'équipe."

function useSquad(leagueId: string, seasonId: string, teamId: string, day: string): SquadMember[] {
  const query = useQuery({
    queryKey: ['season', seasonId, 'squad', teamId, 'all'],
    queryFn: () => listSquad(leagueId, seasonId, teamId, true),
  })
  return squadOnDay(query.data ?? [], day)
}

function PlayerSelect({
  label,
  members,
  value,
  onChange,
  empty,
  required = false,
  field,
}: {
  label: string
  members: SquadMember[]
  value: string
  onChange: (value: string) => void
  empty: string
  required?: boolean
  field: { error: string | null; onInput: () => void }
}) {
  return (
    <SelectField label={label} {...field} required={required} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{empty}</option>
      {members.map((member) => (
        <option key={member.player_id} value={member.player_id}>
          {memberLabel(member)}
        </option>
      ))}
    </SelectField>
  )
}

export function EventForm({ leagueId, seasonId, match, type, onDone, onCancel }: Props) {
  const [teamId, setTeamId] = useState('')
  const [minute, setMinute] = useState(() => (match.kickoff_at === null ? '' : String(elapsedMinute(match.kickoff_at, new Date()))))
  const [playerId, setPlayerId] = useState('')
  const [assistId, setAssistId] = useState('')
  const [playerInId, setPlayerInId] = useState('')
  const [ownGoal, setOwnGoal] = useState(false)
  const [penalty, setPenalty] = useState(false)
  const [note, setNote] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)

  const day = matchDay(match.kickoff_at, new Date())
  const homeSquad = useSquad(leagueId, seasonId, match.home_team.id, day)
  const awaySquad = useSquad(leagueId, seasonId, match.away_team.id, day)
  const isHome = teamId === match.home_team.id
  const teamSquad = teamId === '' ? [] : isHome ? homeSquad : awaySquad
  const otherSquad = teamId === '' ? [] : isHome ? awaySquad : homeSquad
  const isGoal = type === 'goal'
  const withAssist = isGoal && !ownGoal && !penalty
  const scorerSquad = ownGoal ? otherSquad : teamSquad

  const input = (): EventInput => {
    const base = { type, team_id: teamId, minute: toInt(minute) ?? 0, own_goal: false, penalty: false }
    if (isGoal) {
      return {
        ...base,
        player_id: emptyToNull(playerId),
        assist_player_id: withAssist ? emptyToNull(assistId) : null,
        own_goal: ownGoal,
        penalty,
      }
    }
    if (type === 'substitution') {
      return { ...base, player_id: playerId, player_in_id: playerInId }
    }
    if (type === 'injury') {
      return { ...base, player_id: playerId, note: emptyToNull(note.trim()) }
    }
    return { ...base, player_id: playerId }
  }

  const { submit, pending, error, field } = useSubmit(async () => {
    try {
      await recordEvent(leagueId, seasonId, match.id, input())
    } catch (err) {
      const translated = err instanceof ApiError && err.status === 409 ? conflictMessage(err.message) : undefined
      throw translated === undefined ? err : new ApiError(409, translated)
    }
  })

  const chooseTeam = (id: string) => {
    setTeamId(id)
    setPlayerId('')
    setAssistId('')
    setPlayerInId('')
    setInvalid(null)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (teamId === '') {
      setInvalid(NO_TEAM)
      return
    }
    if (await submit()) {
      onDone()
    }
  }

  const teams = [match.home_team, match.away_team]

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset>
        <legend className="block text-sm font-medium text-slate-700">Équipe</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              aria-pressed={teamId === team.id}
              onClick={() => chooseTeam(team.id)}
              className={`rounded-md border px-3 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                teamId === team.id ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {team.name}
            </button>
          ))}
        </div>
      </fieldset>
      {isGoal ? (
        <>
          <div className="flex flex-wrap gap-4 text-sm text-slate-800">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={penalty}
                onChange={(e) => {
                  setPenalty(e.target.checked)
                  if (e.target.checked) {
                    setOwnGoal(false)
                  }
                }}
              />
              Penalty
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ownGoal}
                onChange={(e) => {
                  setOwnGoal(e.target.checked)
                  setPlayerId('')
                  if (e.target.checked) {
                    setPenalty(false)
                  }
                }}
              />
              But contre son camp
            </label>
          </div>
          <PlayerSelect
            label="Buteur"
            members={scorerSquad}
            value={playerId}
            onChange={(value) => {
              setPlayerId(value)
              if (value === assistId) {
                setAssistId('')
              }
            }}
            empty="Buteur inconnu"
            field={field('player_id')}
          />
          {withAssist ? (
            <PlayerSelect
              label="Passeur"
              members={teamSquad.filter((member) => member.player_id !== playerId)}
              value={assistId}
              onChange={setAssistId}
              empty="Aucun"
              field={field('assist_player_id')}
            />
          ) : null}
        </>
      ) : type === 'substitution' ? (
        <div className="grid grid-cols-2 gap-3">
          <PlayerSelect label="Sort" members={teamSquad} value={playerId} onChange={setPlayerId} empty="Choisir…" required field={field('player_id')} />
          <PlayerSelect
            label="Entre"
            members={teamSquad.filter((member) => member.player_id !== playerId)}
            value={playerInId}
            onChange={setPlayerInId}
            empty="Choisir…"
            required
            field={field('player_in_id')}
          />
        </div>
      ) : (
        <PlayerSelect label="Joueur" members={teamSquad} value={playerId} onChange={setPlayerId} empty="Choisir…" required field={field('player_id')} />
      )}
      {type === 'injury' ? (
        <Field label="Note" {...field('note')} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      ) : null}
      <Field label="Minute" {...field('minute')} type="number" min={1} max={150} required value={minute} onChange={(e) => setMinute(e.target.value)} />
      <FormActions error={invalid ?? error} pending={pending} onCancel={onCancel} />
    </form>
  )
}
