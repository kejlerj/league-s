import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { listPlayers } from '@/api/players'
import { joinSquad } from '@/api/squad'
import { today } from '@/lib/dates'
import { toInt } from '@/lib/form'
import { useDebounced } from '@/lib/useDebounced'
import { Field, SelectField } from '@/ui/Field'
import { FormActions } from '@/ui/FormActions'
import { useSubmit } from '@/ui/useSubmit'

type Props = {
  leagueId: string
  seasonId: string
  teamId: string
  excludedPlayerIds: Set<string>
  onDone: () => void
  onCancel: () => void
}

export function JoinForm({ leagueId, seasonId, teamId, excludedPlayerIds, onDone, onCancel }: Props) {
  const [search, setSearch] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [number, setNumber] = useState('')
  const [joinedOn, setJoinedOn] = useState(today())
  const q = useDebounced(search.trim(), 300)
  const players = useQuery({
    queryKey: ['league', leagueId, 'players', q],
    queryFn: () => listPlayers(leagueId, q),
    placeholderData: (previous) => previous,
  })
  const { submit, pending, error, field } = useSubmit(() =>
    joinSquad(leagueId, seasonId, teamId, { player_id: playerId, number: toInt(number), joined_on: joinedOn }),
  )

  const available = (players.data ?? []).filter((player) => !excludedPlayerIds.has(player.id))

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      onDone()
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Rechercher" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      <SelectField label="Joueur" {...field('player_id')} required value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
        <option value="">Choisir…</option>
        {available.map((player) => (
          <option key={player.id} value={player.id}>
            {player.firstname} {player.lastname}
          </option>
        ))}
      </SelectField>
      {players.isSuccess && available.length === 0 ? (
        <p className="text-sm text-slate-700">
          {q === '' ? 'Tous les joueurs de la ligue sont déjà dans un effectif cette saison.' : 'Aucun joueur disponible ne correspond.'} Pour en ajouter un
          nouveau, créez-le d'abord dans l'onglet{' '}
          <Link to={`/leagues/${leagueId}?tab=players`} className="text-emerald-800 underline-offset-2 hover:underline">
            Joueurs
          </Link>{' '}
          de la ligue.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Numéro" {...field('number')} type="number" min={1} max={99} value={number} onChange={(e) => setNumber(e.target.value)} />
        <Field label="Date d'arrivée" {...field('joined_on')} type="date" required value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} />
      </div>
      <FormActions error={error} pending={pending} onCancel={onCancel} submitLabel="Ajouter" />
    </form>
  )
}
