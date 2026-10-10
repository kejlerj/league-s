import { useState, type FormEvent } from 'react'
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
  const { submit, pending, error } = useSubmit(action)
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      onDone()
    }
  }
  return { onSubmit, pending, error }
}

export function ScheduleForm({ leagueId, seasonId, teams, onDone, onCancel }: Common & { teams: SeasonTeam[] }) {
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [matchday, setMatchday] = useState('')
  const [kickoff, setKickoff] = useState('')
  const [venue, setVenue] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  const { submit, pending, error } = useSubmit(() =>
    scheduleMatch(leagueId, seasonId, {
      home_team_id: home,
      away_team_id: away,
      matchday: toInt(matchday) ?? 0,
      kickoff_at: toUtc(kickoff),
      venue: emptyToNull(venue),
    }),
  )

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (home === away) {
      setInvalid('Les deux équipes doivent être différentes.')
      return
    }
    setInvalid(null)
    if (await submit()) {
      onDone()
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
        <SelectField label="Domicile" required value={home} onChange={(e) => setHome(e.target.value)}>
          <option value="">Choisir…</option>
          {options}
        </SelectField>
        <SelectField label="Extérieur" required value={away} onChange={(e) => setAway(e.target.value)}>
          <option value="">Choisir…</option>
          {options}
        </SelectField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Journée" type="number" min={1} required value={matchday} onChange={(e) => setMatchday(e.target.value)} />
        <Field label="Coup d'envoi" type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
      </div>
      <Field label="Lieu" maxLength={100} value={venue} onChange={(e) => setVenue(e.target.value)} />
      <FormActions error={invalid ?? error} pending={pending} onCancel={onCancel} submitLabel="Programmer" />
    </form>
  )
}

export function RescheduleForm({ leagueId, seasonId, match, onDone, onCancel }: Common & { match: Match }) {
  const [matchday, setMatchday] = useState(String(match.matchday))
  const [kickoff, setKickoff] = useState(toLocal(match.kickoff_at))
  const form = useFormSubmit(
    () => updateMatch(leagueId, seasonId, match.id, { matchday: toInt(matchday), kickoff_at: toUtc(kickoff) }),
    onDone,
  )

  return (
    <form onSubmit={form.onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Journée" type="number" min={1} required value={matchday} onChange={(e) => setMatchday(e.target.value)} />
        <Field label="Coup d'envoi" type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
      </div>
      <FormActions error={form.error} pending={form.pending} onCancel={onCancel} />
    </form>
  )
}

export function DetailsForm({ leagueId, seasonId, match, onDone, onCancel }: Common & { match: Match }) {
  const [venue, setVenue] = useState(match.venue ?? '')
  const [referee, setReferee] = useState(match.referee ?? '')
  const [convocation, setConvocation] = useState(toLocal(match.convocation_at))
  const [videoUrl, setVideoUrl] = useState(match.video_url ?? '')
  const form = useFormSubmit(
    () =>
      updateMatch(leagueId, seasonId, match.id, {
        venue: emptyToNull(venue),
        referee: emptyToNull(referee),
        convocation_at: toUtc(convocation),
        video_url: emptyToNull(videoUrl),
      }),
    onDone,
  )

  return (
    <form onSubmit={form.onSubmit} className="space-y-4">
      <Field label="Lieu" maxLength={100} value={venue} onChange={(e) => setVenue(e.target.value)} />
      <Field label="Arbitre" maxLength={100} value={referee} onChange={(e) => setReferee(e.target.value)} />
      <Field label="Convocation" type="datetime-local" value={convocation} onChange={(e) => setConvocation(e.target.value)} />
      <Field label="Lien vidéo (URL)" type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
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
      <Field label="Nouvelle date" type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
      <FormActions error={form.error} pending={form.pending} onCancel={onCancel} submitLabel="Reporter" />
    </form>
  )
}
