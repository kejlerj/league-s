import { useState, type FormEvent } from 'react'
import { setScore } from '@/api/matches'
import type { Match } from '@/api/types'
import { toInt } from '@/lib/form'
import { Field } from '@/ui/Field'
import { FormActions } from '@/ui/FormActions'
import { useSubmit } from '@/ui/useSubmit'

type Props = { leagueId: string; seasonId: string; match: Match; onDone: () => void; onCancel: () => void }

export function ScoreForm({ leagueId, seasonId, match, onDone, onCancel }: Props) {
  const [home, setHome] = useState(String(match.home_score ?? 0))
  const [away, setAway] = useState(String(match.away_score ?? 0))
  const { submit, pending, error } = useSubmit(() =>
    setScore(leagueId, seasonId, match.id, toInt(home) ?? 0, toInt(away) ?? 0),
  )

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      onDone()
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={match.home_team.name} type="number" min={0} required value={home} onChange={(e) => setHome(e.target.value)} />
        <Field label={match.away_team.name} type="number" min={0} required value={away} onChange={(e) => setAway(e.target.value)} />
      </div>
      <FormActions error={error} pending={pending} onCancel={onCancel} />
    </form>
  )
}
