import { useState, type FormEvent } from 'react'
import { createSeason, updateSeason } from '@/api/seasons'
import type { Season, TieBreaker } from '@/api/types'
import { dateToUtc, utcToDate } from '@/lib/dates'
import { Field } from '@/ui/Field'
import { FormActions } from '@/ui/FormActions'
import { useSubmit } from '@/ui/useSubmit'

export const TIE_BREAKER_LABELS: Record<TieBreaker, string> = {
  goal_difference: 'Différence de buts',
  goals_scored: 'Buts marqués',
  head_to_head: 'Confrontations directes',
  fair_play: 'Fair-play',
  random: 'Tirage au sort',
}

const TIE_BREAKERS = Object.keys(TIE_BREAKER_LABELS) as TieBreaker[]

type Props = { leagueId: string; initial?: Season; onDone: () => void; onCancel: () => void }

export function SeasonForm({ leagueId, initial, onDone, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [startOn, setStartOn] = useState(initial ? utcToDate(initial.start_on) : '')
  const [endOn, setEndOn] = useState(initial ? utcToDate(initial.end_on) : '')
  const [win, setWin] = useState(initial?.match_win_pts ?? 3)
  const [draw, setDraw] = useState(initial?.match_draw_pts ?? 1)
  const [loss, setLoss] = useState(initial?.match_loss_pts ?? 0)
  const [tieBreakers, setTieBreakers] = useState<TieBreaker[]>(initial?.tie_breakers ?? ['goal_difference', 'goals_scored'])
  const [invalid, setInvalid] = useState<string | null>(null)
  const { submit, pending, error } = useSubmit(() => {
    const input = {
      name: name.trim(),
      start_on: dateToUtc(startOn),
      end_on: dateToUtc(endOn),
      match_win_pts: win,
      match_draw_pts: draw,
      match_loss_pts: loss,
      tie_breakers: tieBreakers,
    }
    return initial ? updateSeason(leagueId, initial.id, input) : createSeason(leagueId, input)
  })

  const toggle = (tieBreaker: TieBreaker) => {
    setTieBreakers((current) =>
      current.includes(tieBreaker) ? current.filter((item) => item !== tieBreaker) : [...current, tieBreaker],
    )
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (endOn <= startOn) {
      setInvalid('La fin doit être après le début.')
      return
    }
    setInvalid(null)
    if (await submit()) {
      onDone()
    }
  }

  const points = (label: string, value: number, set: (value: number) => void) => (
    <Field label={label} type="number" min={0} required value={value} onChange={(e) => set(Number(e.target.value))} />
  )

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Nom" required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Début" type="date" required value={startOn} onChange={(e) => setStartOn(e.target.value)} />
        <Field label="Fin" type="date" required value={endOn} onChange={(e) => setEndOn(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {points('Points victoire', win, setWin)}
        {points('Points nul', draw, setDraw)}
        {points('Points défaite', loss, setLoss)}
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Départages, dans l'ordre de sélection</legend>
        <div className="mt-2 space-y-1">
          {TIE_BREAKERS.map((tieBreaker) => {
            const rank = tieBreakers.indexOf(tieBreaker)
            return (
              <div key={tieBreaker} className="flex items-center gap-2 text-sm text-slate-800">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={rank >= 0} onChange={() => toggle(tieBreaker)} />
                  {TIE_BREAKER_LABELS[tieBreaker]}
                </label>
                {rank >= 0 ? <span className="text-xs text-slate-500">n° {rank + 1}</span> : null}
              </div>
            )
          })}
        </div>
      </fieldset>
      <FormActions error={invalid ?? error} pending={pending} onCancel={onCancel} />
    </form>
  )
}
