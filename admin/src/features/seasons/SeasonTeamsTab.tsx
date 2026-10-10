import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { addSeasonTeam, listSeasonTeams, removeSeasonTeam } from '@/api/seasons'
import { listTeams } from '@/api/teams'
import type { SeasonTeam } from '@/api/types'
import { Button } from '@/ui/Button'
import { ConfirmDialog } from '@/ui/ConfirmDialog'
import { DataTable, type Column } from '@/ui/DataTable'
import { FormError, SelectField } from '@/ui/Field'
import { PageState } from '@/ui/PageState'
import { useSubmit } from '@/ui/useSubmit'

export function SeasonTeamsTab({ leagueId, seasonId }: { leagueId: string; seasonId: string }) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState('')
  const [removing, setRemoving] = useState<SeasonTeam | null>(null)
  const key = ['season', seasonId, 'teams']
  const registered = useQuery({ queryKey: key, queryFn: () => listSeasonTeams(leagueId, seasonId) })
  const all = useQuery({ queryKey: ['league', leagueId, 'teams'], queryFn: () => listTeams(leagueId) })
  const { submit, pending, error } = useSubmit(async () => {
    await addSeasonTeam(leagueId, seasonId, selected)
    setSelected('')
    await queryClient.invalidateQueries({ queryKey: key })
  })

  const registeredIds = new Set((registered.data ?? []).map((team) => team.id))
  const available = (all.data ?? []).filter((team) => !registeredIds.has(team.id))

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (selected !== '') {
      void submit()
    }
  }

  const columns: Column<SeasonTeam>[] = [
    {
      header: 'Équipe',
      cell: (team) => (
        <Link
          to={`/leagues/${leagueId}/seasons/${seasonId}/teams/${team.id}`}
          className="font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          {team.name}
        </Link>
      ),
    },
    {
      header: '',
      align: 'right',
      cell: (team) => (
        <Button variant="link" onClick={() => setRemoving(team)}>
          Désinscrire
        </Button>
      ),
    },
  ]

  return (
    <div>
      <form onSubmit={onSubmit} className="mb-3 flex items-end gap-3">
        <SelectField label="Inscrire une équipe" className="w-72" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choisir…</option>
          {available.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </SelectField>
        <Button type="submit" variant="primary" pending={pending} disabled={selected === ''}>
          Inscrire
        </Button>
      </form>
      <div className="mb-3">
        <FormError message={error} />
      </div>
      <PageState query={registered}>
        {(rows) => <DataTable rows={rows} columns={columns} rowKey={(team) => team.id} empty="Aucune équipe inscrite." />}
      </PageState>
      <ConfirmDialog
        open={removing !== null}
        title="Désinscrire l'équipe"
        message={`Désinscrire « ${removing?.name ?? ''} » de la saison ?`}
        confirmLabel="Désinscrire"
        errorOverrides={{ 409: 'Cette équipe a des matchs dans la saison.' }}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing !== null) {
            await removeSeasonTeam(leagueId, seasonId, removing.id)
            await queryClient.invalidateQueries({ queryKey: key })
          }
        }}
      />
    </div>
  )
}
