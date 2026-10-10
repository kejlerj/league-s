import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { deleteLeague, listLeagues } from '@/api/leagues'
import type { LeagueRef } from '@/api/types'
import { useSession } from '@/auth/SessionProvider'
import { Button } from '@/ui/Button'
import { ConfirmDialog } from '@/ui/ConfirmDialog'
import { DataTable, type Column } from '@/ui/DataTable'
import { Modal } from '@/ui/Modal'
import { PageState } from '@/ui/PageState'
import { LeagueForm } from './LeagueForm'

export function LeaguesPage() {
  const { me, isSuperadmin, refresh } = useSession()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<LeagueRef | null>(null)
  const query = useQuery({
    queryKey: ['leagues'],
    queryFn: (): Promise<LeagueRef[]> => listLeagues(),
    enabled: isSuperadmin,
  })

  const changed = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['leagues'] }), refresh()])
  }

  const columns: Column<LeagueRef>[] = [
    {
      header: 'Ligue',
      cell: (league) => (
        <Link to={`/leagues/${league.id}`} className="font-medium text-emerald-800 underline-offset-2 hover:underline">
          {league.name}
        </Link>
      ),
    },
  ]
  if (isSuperadmin) {
    columns.push({
      header: '',
      align: 'right',
      cell: (league) => (
        <Button variant="link" onClick={() => setDeleting(league)}>
          Supprimer
        </Button>
      ),
    })
  }

  if (!isSuperadmin && me?.leagues.length === 1) {
    return <Navigate to={`/leagues/${me.leagues[0].id}`} replace />
  }

  const table = (rows: LeagueRef[]) => (
    <DataTable rows={rows} columns={columns} rowKey={(league) => league.id} empty="Aucune ligue." />
  )

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Ligues</h1>
        {isSuperadmin ? (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Nouvelle ligue
          </Button>
        ) : null}
      </div>
      {isSuperadmin ? <PageState query={query}>{table}</PageState> : table(me?.leagues ?? [])}
      <Modal title="Nouvelle ligue" open={creating} onClose={() => setCreating(false)}>
        <LeagueForm
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            void changed()
          }}
        />
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer la ligue"
        message={`Supprimer « ${deleting?.name ?? ''} » ?`}
        confirmLabel="Supprimer"
        errorOverrides={{ 409: 'Cette ligue a un historique.' }}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting !== null) {
            await deleteLeague(deleting.id)
            await changed()
          }
        }}
      />
    </div>
  )
}
