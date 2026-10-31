import { useState, type FormEvent } from 'react'
import { transfer } from '@/api/squad'
import type { SeasonTeam, SquadMember } from '@/api/types'
import { today } from '@/lib/dates'
import { toInt } from '@/lib/form'
import { Field, SelectField } from '@/ui/Field'
import { FormActions } from '@/ui/FormActions'
import { useSubmit } from '@/ui/useSubmit'

type Props = {
  leagueId: string
  seasonId: string
  teamId: string
  member: SquadMember
  teams: SeasonTeam[]
  onDone: (toTeamId: string) => void
  onCancel: () => void
}

export function TransferForm({ leagueId, seasonId, teamId, member, teams, onDone, onCancel }: Props) {
  const [toTeamId, setToTeamId] = useState('')
  const [number, setNumber] = useState('')
  const [on, setOn] = useState(today())
  const { submit, pending, error, field } = useSubmit(() =>
    transfer(leagueId, seasonId, {
      player_id: member.player_id,
      from_team_id: teamId,
      to_team_id: toTeamId,
      number: toInt(number),
      on,
    }),
  )

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      onDone(toTeamId)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-slate-700">
        {member.firstname} {member.lastname}
      </p>
      <SelectField label="Vers" {...field('to_team_id')} required value={toTeamId} onChange={(e) => setToTeamId(e.target.value)}>
        <option value="">Choisir…</option>
        {teams
          .filter((team) => team.id !== teamId)
          .map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Numéro" {...field('number')} type="number" min={1} max={99} value={number} onChange={(e) => setNumber(e.target.value)} />
        <Field label="Dernier jour dans l'équipe actuelle" {...field('on')} type="date" required value={on} onChange={(e) => setOn(e.target.value)} />
      </div>
      <p className="text-sm text-slate-600">Il rejoint la nouvelle équipe le lendemain.</p>
      <FormActions error={error} pending={pending} onCancel={onCancel} submitLabel="Transférer" />
    </form>
  )
}
