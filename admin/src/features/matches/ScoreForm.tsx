import { useState, type FormEvent } from 'react'
import { setScore } from '@/api/matches'
import type { Match } from '@/api/types'
import { toInt } from '@/lib/form'
import { Field } from '@/ui/Field'
import { FormActions } from '@/ui/FormActions'
import { useSubmit } from '@/ui/useSubmit'

type Props = { leagueId: string; seasonId: string; match: Match; onDone: () => void; onCancel: () => void }

const BELOW_GOALS = 'Le score ne peut pas être inférieur au nombre de buts saisis.'

export function ScoreForm({ leagueId, seasonId, match, onDone, onCancel }: Props) {
  const [home, setHome] = useState(String(match.home_score ?? 0))
  const [away, setAway] = useState(String(match.away_score ?? 0))
  const { submit, pending, error, field } = useSubmit(
    () => setScore(leagueId, seasonId, match.id, toInt(home) ?? 0, toInt(away) ?? 0),
    { 409: BELOW_GOALS },
  )

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      onDone()
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {match.status === 'finished' ? (
        <p className="text-sm text-slate-700">Le match est terminé : le classement sera mis à jour avec le nouveau score.</p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label={match.home_team.name} {...field('home')} type="number" min={0} required value={home} onChange={(e) => setHome(e.target.value)} />
        <Field label={match.away_team.name} {...field('away')} type="number" min={0} required value={away} onChange={(e) => setAway(e.target.value)} />
      </div>
      <FormActions error={error} pending={pending} onCancel={onCancel} />
    </form>
  )
}
