import { useState, type FormEvent } from 'react'
import { ApiError } from '@/api/client'
import { createSeason, updateSeason } from '@/api/seasons'
import type { Season, TieBreaker } from '@/api/types'
import { toInt } from '@/lib/form'
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

const END_BEFORE_START = 'La fin doit être après le début.'

const CONFLICTS: Record<string, { field: string; message: string }> = {
  'season overlaps another season of the league': {
    field: 'dates',
    message: "Ces dates chevauchent une autre saison de la ligue. Une ligue n'a qu'une saison à la fois.",
  },
  'season name is already taken': { field: 'name', message: 'Ce nom est déjà pris dans la ligue.' },
  'season dates would leave squad memberships outside the season': {
    field: 'dates',
    message: "Des joueurs ont des dates d'effectif en dehors de ces dates. Modifiez leurs arrivées ou départs d'abord.",
  },
  'season dates would leave matches outside the season': {
    field: 'dates',
    message: "Des matchs sont programmés en dehors de ces dates. Déplacez-les d'abord.",
  },
}

async function conflictsOnFields<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch (err) {
    const conflict = err instanceof ApiError && err.status === 409 ? CONFLICTS[err.message] : undefined
    if (conflict !== undefined) {
      throw new ApiError(409, (err as ApiError).message, { [conflict.field]: conflict.message })
    }
    throw err
  }
}

function FieldMessage({ error }: { error: string | null }) {
  return error ? <p className="text-sm text-red-700">{error}</p> : null
}

type Props = { leagueId: string; initial?: Season; onDone: () => void; onCancel: () => void }

export function SeasonForm({ leagueId, initial, onDone, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [startOn, setStartOn] = useState(initial?.start_on ?? '')
  const [endOn, setEndOn] = useState(initial?.end_on ?? '')
  const [win, setWin] = useState(initial?.match_win_pts ?? 3)
  const [draw, setDraw] = useState(initial?.match_draw_pts ?? 1)
  const [loss, setLoss] = useState(initial?.match_loss_pts ?? 0)
  const [tieBreakers, setTieBreakers] = useState<TieBreaker[]>(initial?.tie_breakers ?? ['goal_difference', 'goals_scored'])
  const [maxSquadSize, setMaxSquadSize] = useState(initial?.max_squad_size?.toString() ?? '')
  const [endBeforeStart, setEndBeforeStart] = useState(false)
  const { submit, pending, error, field } = useSubmit(() => {
    const input = {
      name: name.trim(),
      start_on: startOn,
      end_on: endOn,
      match_win_pts: win,
      match_draw_pts: draw,
      match_loss_pts: loss,
      tie_breakers: tieBreakers,
    }
    if (initial) {
      return conflictsOnFields(updateSeason(leagueId, initial.id, input))
    }
    const max = toInt(maxSquadSize)
    return conflictsOnFields(createSeason(leagueId, max === null ? input : { ...input, max_squad_size: max }))
  })

  const dates = field('dates')
  const end = field('end_on')
  const tieBreakersField = field('tie_breakers')

  const toggle = (tieBreaker: TieBreaker) => {
    setTieBreakers((current) =>
      current.includes(tieBreaker) ? current.filter((item) => item !== tieBreaker) : [...current, tieBreaker],
    )
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (endOn <= startOn) {
      setEndBeforeStart(true)
      return
    }
    setEndBeforeStart(false)
    if (await submit()) {
      onDone()
    }
  }

  const onDateInput = () => {
    dates.onInput()
    setEndBeforeStart(false)
  }

  const points = (label: string, key: string, value: number, set: (value: number) => void) => (
    <Field label={label} {...field(key)} type="number" min={0} required value={value} onChange={(e) => set(Number(e.target.value))} />
  )

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Nom" {...field('name')} required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="space-y-1">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Début"
            {...field('start_on')}
            type="date"
            required
            value={startOn}
            onChange={(e) => setStartOn(e.target.value)}
            onInput={() => {
              field('start_on').onInput()
              onDateInput()
            }}
          />
          <Field
            label="Fin"
            error={endBeforeStart ? END_BEFORE_START : end.error}
            type="date"
            required
            value={endOn}
            onChange={(e) => setEndOn(e.target.value)}
            onInput={() => {
              end.onInput()
              onDateInput()
            }}
          />
        </div>
        <FieldMessage error={dates.error} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {points('Points victoire', 'match_win_pts', win, setWin)}
        {points('Points nul', 'match_draw_pts', draw, setDraw)}
        {points('Points défaite', 'match_loss_pts', loss, setLoss)}
      </div>
      <div>
        <Field
          label="Taille max. d'un effectif"
          {...field('max_squad_size')}
          type="number"
          min={1}
          disabled={initial !== undefined}
          value={maxSquadSize}
          onChange={(e) => setMaxSquadSize(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          {initial ? 'Ne se modifie pas après la création.' : 'Laisser vide pour ne pas limiter.'}
        </p>
      </div>
      <fieldset onInput={tieBreakersField.onInput}>
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
        <FieldMessage error={tieBreakersField.error} />
      </fieldset>
      <FormActions error={error} pending={pending} onCancel={onCancel} />
    </form>
  )
}
