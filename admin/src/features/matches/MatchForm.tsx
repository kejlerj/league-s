import { useRef, useState, type FormEvent } from 'react'
import { postponeMatch, scheduleMatch, updateMatch } from '@/api/matches'
import type { Match, SeasonTeam } from '@/api/types'
import { localToUtc, utcToLocal } from '@/lib/dates'
import { emptyToNull, toInt } from '@/lib/form'
import { Field, SelectField } from '@/ui/Field'
import { FormActions } from '@/ui/FormActions'
import { useSubmit } from '@/ui/useSubmit'

type Common = { leagueId: string; seasonId: string; onDone: () => void; onCancel: () => void }

const toUtc = (value: string) => (value === '' ? null : localToUtc(value))
const toLocal = (value: string | null) => (value === null ? '' : utcToLocal(value))

function useFormSubmit(action: () => Promise<unknown>, onDone: () => void) {
  const { submit, pending, error, field } = useSubmit(action)
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      onDone()
    }
  }
  return { onSubmit, pending, error, field }
}

type ScheduleProps = Omit<Common, 'onDone'> & { teams: SeasonTeam[]; onScheduled: (match: Match) => void }

export function ScheduleForm({ leagueId, seasonId, teams, onScheduled, onCancel }: ScheduleProps) {
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [matchday, setMatchday] = useState('')
  const [kickoff, setKickoff] = useState('')
  const [venue, setVenue] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  const scheduled = useRef<Match | null>(null)
  const { submit, pending, error, field } = useSubmit(async () => {
    scheduled.current = await scheduleMatch(leagueId, seasonId, {
      home_team_id: home,
      away_team_id: away,
      matchday: toInt(matchday) ?? 0,
      kickoff_at: toUtc(kickoff),
      venue: emptyToNull(venue),
    })
  })

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (home === away) {
      setInvalid('Les deux équipes doivent être différentes.')
      return
    }
    setInvalid(null)
    if ((await submit()) && scheduled.current !== null) {
      onScheduled(scheduled.current)
    }
  }

  const options = teams.map((team) => (
    <option key={team.id} value={team.id}>
      {team.name}
    </option>
  ))

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Domicile" {...field('home_team_id')} required value={home} onChange={(e) => setHome(e.target.value)}>
          <option value="">Choisir…</option>
          {options}
        </SelectField>
        <SelectField label="Extérieur" {...field('away_team_id')} required value={away} onChange={(e) => setAway(e.target.value)}>
          <option value="">Choisir…</option>
          {options}
        </SelectField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Journée" {...field('matchday')} type="number" min={1} required value={matchday} onChange={(e) => setMatchday(e.target.value)} />
        <Field label="Coup d'envoi" {...field('kickoff_at')} type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
      </div>
      <Field label="Lieu" {...field('venue')} maxLength={100} value={venue} onChange={(e) => setVenue(e.target.value)} />
      <FormActions error={invalid ?? error} pending={pending} onCancel={onCancel} submitLabel="Programmer" />
    </form>
  )
}

export function EditForm({ leagueId, seasonId, match, onDone, onCancel }: Common & { match: Match }) {
  const canReschedule = match.status === 'scheduled' || match.status === 'postponed'
  const [matchday, setMatchday] = useState(String(match.matchday))
  const [kickoff, setKickoff] = useState(toLocal(match.kickoff_at))
  const [venue, setVenue] = useState(match.venue ?? '')
  const [referee, setReferee] = useState(match.referee ?? '')
  const [convocation, setConvocation] = useState(toLocal(match.convocation_at))
  const [videoUrl, setVideoUrl] = useState(match.video_url ?? '')
  const form = useFormSubmit(
    () =>
      updateMatch(leagueId, seasonId, match.id, {
        matchday: canReschedule ? toInt(matchday) : null,
        kickoff_at: canReschedule ? toUtc(kickoff) : null,
        venue: emptyToNull(venue),
        referee: emptyToNull(referee),
        convocation_at: toUtc(convocation),
        video_url: emptyToNull(videoUrl),
      }),
    onDone,
  )

  return (
    <form onSubmit={form.onSubmit} className="space-y-4">
      {canReschedule ? (
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Journée"
            {...form.field('matchday')}
            type="number"
            min={1}
            required
            value={matchday}
            onChange={(e) => setMatchday(e.target.value)}
          />
          <Field
            label="Coup d'envoi"
            {...form.field('kickoff_at')}
            type="datetime-local"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
          />
        </div>
      ) : null}
      <Field label="Lieu" {...form.field('venue')} maxLength={100} value={venue} onChange={(e) => setVenue(e.target.value)} />
      <Field label="Arbitre" {...form.field('referee')} maxLength={100} value={referee} onChange={(e) => setReferee(e.target.value)} />
      <Field label="Convocation" {...form.field('convocation_at')} type="datetime-local" value={convocation} onChange={(e) => setConvocation(e.target.value)} />
      <Field label="Lien vidéo (URL)" {...form.field('video_url')} type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
      <FormActions error={form.error} pending={form.pending} onCancel={onCancel} />
    </form>
  )
}

export function PostponeForm({ leagueId, seasonId, match, onDone, onCancel }: Common & { match: Match }) {
  const [kickoff, setKickoff] = useState('')
  const form = useFormSubmit(() => postponeMatch(leagueId, seasonId, match.id, toUtc(kickoff)), onDone)

  return (
    <form onSubmit={form.onSubmit} className="space-y-4">
      <p className="text-sm text-slate-700">Sans nouvelle date, le match reste « Reporté » jusqu'à sa reprogrammation.</p>
      {match.status === 'live' ? (
        <p className="text-sm text-slate-700">Le match est interrompu : son score est conservé jusqu'à sa reprogrammation, puis il repartira de 0 – 0.</p>
      ) : null}
      <Field label="Nouvelle date" {...form.field('kickoff_at')} type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
      <FormActions error={form.error} pending={form.pending} onCancel={onCancel} submitLabel="Reporter" />
    </form>
  )
}
