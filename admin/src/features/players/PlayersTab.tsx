import { useState } from 'react'
import { deletePlayer, listPlayers } from '@/api/players'
import type { Player } from '@/api/types'
import { useDebounced } from '@/lib/useDebounced'
import { Field } from '@/ui/Field'
import { ResourceTab } from '@/ui/ResourceTab'
import { PlayerForm } from './PlayerForm'

export function PlayersTab({ leagueId }: { leagueId: string }) {
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim(), 300)

  return (
    <ResourceTab<Player>
      queryKey={['league', leagueId, 'players', q]}
      queryFn={() => listPlayers(leagueId, q)}
      invalidate={['league', leagueId, 'players']}
      columns={[{ header: 'Joueur', cell: (player) => `${player.firstname} ${player.lastname}` }]}
      rowKey={(player) => player.id}
      describe={(player) => `${player.firstname} ${player.lastname}`}
      empty="Aucun joueur."
      newLabel="Nouveau joueur"
      editTitle="Modifier le joueur"
      removeTitle="Supprimer le joueur"
      conflict="Ce joueur a un historique."
      remove={(player) => deletePlayer(leagueId, player.id)}
      form={(props) => <PlayerForm leagueId={leagueId} {...props} />}
      toolbar={<Field label="Rechercher" type="search" className="w-64" value={search} onChange={(e) => setSearch(e.target.value)} />}
    />
  )
}
