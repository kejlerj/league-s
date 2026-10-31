import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { listSeasonTeams } from '@/api/seasons'
import { changeNumber, leaveSquad, listSquad } from '@/api/squad'
import type { SquadMember } from '@/api/types'
import { formatDate, today } from '@/lib/dates'
import { toInt } from '@/lib/form'
import { Button } from '@/ui/Button'
import { DataTable, type Column } from '@/ui/DataTable'
import { Field } from '@/ui/Field'
import { FormActions } from '@/ui/FormActions'
import { Modal } from '@/ui/Modal'
import { PageState } from '@/ui/PageState'
import { useSubmit } from '@/ui/useSubmit'
import { JoinForm } from './JoinForm'
import { TransferForm } from './TransferForm'

type Dialog =
  | { kind: 'join' }
  | { kind: 'number'; member: SquadMember }
  | { kind: 'leave'; member: SquadMember }
  | { kind: 'transfer'; member: SquadMember }

type InlineProps = { label: string; type: 'number' | 'date'; initial: string; save: (value: string) => Promise<unknown>; onDone: () => void; onCancel: () => void }

function SingleFieldForm({ label, type, initial, save, onDone, onCancel }: InlineProps) {
  const [value, setValue] = useState(initial)
  const { submit, pending, error } = useSubmit(() => save(value))

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      onDone()
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        label={label}
        type={type}
        min={type === 'number' ? 1 : undefined}
        max={type === 'number' ? 99 : undefined}
        required={type === 'date'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <FormActions error={error} pending={pending} onCancel={onCancel} />
    </form>
  )
}

export function SquadPage() {
  const { leagueId = '', seasonId = '', teamId = '' } = useParams()
  const queryClient = useQueryClient()
  const [all, setAll] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const teams = useQuery({ queryKey: ['season', seasonId, 'teams'], queryFn: () => listSeasonTeams(leagueId, seasonId) })
  const squad = useQuery({
    queryKey: ['season', seasonId, 'squad', teamId, all],
    queryFn: () => listSquad(leagueId, seasonId, teamId, all),
    placeholderData: (previous) => previous,
  })

  const close = () => setDialog(null)
  const changed = (otherTeamId?: string) => {
    close()
    void queryClient.invalidateQueries({ queryKey: ['season', seasonId, 'squad', teamId] })
    if (otherTeamId !== undefined) {
      void queryClient.invalidateQueries({ queryKey: ['season', seasonId, 'squad', otherTeamId] })
    }
  }

  const columns: Column<SquadMember>[] = [
    { header: 'N°', cell: (member) => member.number ?? '—' },
    { header: 'Joueur', cell: (member) => `${member.firstname} ${member.lastname}` },
    { header: 'Arrivée', cell: (member) => formatDate(member.joined_on) },
    { header: 'Départ', cell: (member) => formatDate(member.left_on) },
    {
      header: '',
      align: 'right',
      cell: (member) =>
        member.left_on === null ? (
          <span className="whitespace-nowrap">
            <Button variant="link" onClick={() => setDialog({ kind: 'number', member })}>
              Numéro
            </Button>
            <Button variant="link" onClick={() => setDialog({ kind: 'leave', member })}>
              Départ
            </Button>
            <Button variant="link" onClick={() => setDialog({ kind: 'transfer', member })}>
              Transférer
            </Button>
          </span>
        ) : null,
    },
  ]

  const team = teams.data?.find((item) => item.id === teamId)
  const elsewhere = useQueries({
    queries: (teams.data ?? [])
      .filter((item) => item.id !== teamId)
      .map((item) => ({
        queryKey: ['season', seasonId, 'squad', item.id, false],
        queryFn: () => listSquad(leagueId, seasonId, item.id, false),
      })),
  })
  const active = [...(squad.data ?? []), ...elsewhere.flatMap((query) => query.data ?? [])]
  const present = new Set(active.filter((member) => member.left_on === null).map((member) => member.player_id))

  const titles: Record<Dialog['kind'], string> = {
    join: 'Ajouter un joueur',
    number: 'Changer le numéro',
    leave: 'Enregistrer un départ',
    transfer: 'Transférer le joueur',
  }

  return (
    <div>
      <Link to={`/leagues/${leagueId}/seasons/${seasonId}`} className="text-sm text-emerald-800 underline-offset-2 hover:underline">
        Retour à la saison
      </Link>
      <div className="mb-4 mt-2 flex items-center gap-4">
        <h1 className="text-xl font-semibold text-slate-900">{team?.name ?? 'Effectif'}</h1>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          Afficher les départs
        </label>
        <Button variant="primary" onClick={() => setDialog({ kind: 'join' })}>
          Ajouter un joueur
        </Button>
      </div>
      <PageState query={squad}>
        {(rows) => (
          <DataTable rows={rows} columns={columns} rowKey={(member) => member.membership_id} empty="Aucun joueur dans l'effectif." />
        )}
      </PageState>
      <Modal title={dialog ? titles[dialog.kind] : ''} open={dialog !== null} onClose={close}>
        {dialog?.kind === 'join' ? (
          <JoinForm
            leagueId={leagueId}
            seasonId={seasonId}
            teamId={teamId}
            excludedPlayerIds={present}
            onCancel={close}
            onDone={() => changed()}
          />
        ) : null}
        {dialog?.kind === 'number' ? (
          <SingleFieldForm
            label="Numéro"
            type="number"
            initial={dialog.member.number === null ? '' : String(dialog.member.number)}
            save={(value) => changeNumber(leagueId, seasonId, teamId, dialog.member.membership_id, toInt(value))}
            onCancel={close}
            onDone={() => changed()}
          />
        ) : null}
        {dialog?.kind === 'leave' ? (
          <SingleFieldForm
            label="Date de départ"
            type="date"
            initial={today()}
            save={(value) => leaveSquad(leagueId, seasonId, teamId, dialog.member.membership_id, value)}
            onCancel={close}
            onDone={() => changed()}
          />
        ) : null}
        {dialog?.kind === 'transfer' ? (
          <TransferForm
            leagueId={leagueId}
            seasonId={seasonId}
            teamId={teamId}
            member={dialog.member}
            teams={teams.data ?? []}
            onCancel={close}
            onDone={(toTeamId) => changed(toTeamId)}
          />
        ) : null}
      </Modal>
    </div>
  )
}
