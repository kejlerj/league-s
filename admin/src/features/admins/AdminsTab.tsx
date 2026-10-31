import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { cancelInvitation, invite, listAdmins, listInvitations, removeAdmin } from '@/api/admins'
import type { CreatedInvitation, Invitation, LeagueAdmin } from '@/api/types'
import { useSession } from '@/auth/SessionProvider'
import { formatDateTime } from '@/lib/dates'
import { Button } from '@/ui/Button'
import { ConfirmDialog } from '@/ui/ConfirmDialog'
import { DataTable, type Column } from '@/ui/DataTable'
import { Field, FormError } from '@/ui/Field'
import { PageState } from '@/ui/PageState'
import { useSubmit } from '@/ui/useSubmit'

type Props = { leagueId: string; leagueName: string }

function mailto(invitation: CreatedInvitation, leagueName: string): string {
  const subject = `Invitation à administrer ${leagueName}`
  const body = `Bonjour,\n\nVous êtes invité à administrer la ligue ${leagueName}.\nOuvrez ce lien pour créer votre accès (valable 7 jours, utilisable une fois) :\n${invitation.link}\n`
  return `mailto:${encodeURIComponent(invitation.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function InviteForm({ leagueId, leagueName, onInvited }: Props & { onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [created, setCreated] = useState<CreatedInvitation | null>(null)
  const [copied, setCopied] = useState(false)
  const { submit, pending, error, field } = useSubmit(
    async () => {
      setCreated(await invite(leagueId, email.trim()))
      setCopied(false)
      setEmail('')
      onInvited()
    },
    { 409: 'Cette personne est déjà admin de la ligue.' },
  )

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setCreated(null)
    void submit()
  }

  const copy = async () => {
    if (created !== null) {
      await navigator.clipboard.writeText(created.link)
      setCopied(true)
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-base font-semibold text-slate-900">Inviter un admin</h2>
      <form onSubmit={onSubmit} className="flex items-end gap-3">
        <Field label="E-mail" {...field('email')} type="email" required className="w-72" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" variant="primary" pending={pending}>
          Inviter
        </Button>
      </form>
      <div className="mt-3">
        <FormError message={error} />
      </div>
      {created !== null ? (
        <div className="mt-3 space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-900">Invitation créée pour {created.email}.</p>
          <p className="text-sm text-slate-700">
            Ce lien n'est affiché qu'une fois. Il est valable 7 jours et utilisable une seule fois.
          </p>
          <Field label="Lien d'invitation" readOnly value={created.link} onFocus={(e) => e.target.select()} />
          <div className="flex items-center gap-3">
            <Button onClick={() => void copy()}>Copier le lien</Button>
            <a href={mailto(created, leagueName)} className="text-sm text-emerald-800 underline-offset-2 hover:underline">
              Envoyer par e-mail
            </a>
            {copied ? <span className="text-sm text-slate-600">Lien copié.</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function AdminsTab({ leagueId, leagueName }: Props) {
  const { isSuperadmin } = useSession()
  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState<LeagueAdmin | null>(null)
  const [cancelling, setCancelling] = useState<Invitation | null>(null)
  const adminsKey = ['league', leagueId, 'admins']
  const invitationsKey = ['league', leagueId, 'invitations']
  const admins = useQuery({ queryKey: adminsKey, queryFn: () => listAdmins(leagueId) })
  const invitations = useQuery({
    queryKey: invitationsKey,
    queryFn: () => listInvitations(leagueId),
    enabled: isSuperadmin,
  })

  const adminColumns: Column<LeagueAdmin>[] = [
    { header: 'Nom', cell: (admin) => admin.name },
    { header: 'E-mail', cell: (admin) => admin.email },
  ]
  if (isSuperadmin) {
    adminColumns.push({
      header: '',
      align: 'right',
      cell: (admin) => (
        <Button variant="link" onClick={() => setRemoving(admin)}>
          Retirer
        </Button>
      ),
    })
  }

  const invitationColumns: Column<Invitation>[] = [
    { header: 'E-mail', cell: (invitation) => invitation.email },
    { header: 'Expire le', cell: (invitation) => formatDateTime(invitation.expires_at) },
    {
      header: '',
      align: 'right',
      cell: (invitation) => (
        <Button variant="link" onClick={() => setCancelling(invitation)}>
          Annuler
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageState query={admins}>
        {(rows) => <DataTable rows={rows} columns={adminColumns} rowKey={(admin) => admin.id} empty="Aucun admin." />}
      </PageState>
      {isSuperadmin ? (
        <>
          <InviteForm
            leagueId={leagueId}
            leagueName={leagueName}
            onInvited={() => void queryClient.invalidateQueries({ queryKey: invitationsKey })}
          />
          <section className="mt-8">
            <h2 className="mb-2 text-base font-semibold text-slate-900">Invitations en attente</h2>
            <PageState query={invitations}>
              {(rows) => (
                <DataTable
                  rows={rows}
                  columns={invitationColumns}
                  rowKey={(invitation) => invitation.id}
                  empty="Aucune invitation en attente."
                />
              )}
            </PageState>
          </section>
        </>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        title="Retirer l'admin"
        message={`Retirer ${removing?.name ?? ''} des admins de cette ligue ? Son compte n'est pas supprimé.`}
        confirmLabel="Retirer"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing !== null) {
            await removeAdmin(leagueId, removing.id)
            await queryClient.invalidateQueries({ queryKey: adminsKey })
          }
        }}
      />
      <ConfirmDialog
        open={cancelling !== null}
        title="Annuler l'invitation"
        message={`Annuler l'invitation envoyée à ${cancelling?.email ?? ''} ? Le lien ne fonctionnera plus.`}
        confirmLabel="Annuler l'invitation"
        onClose={() => setCancelling(null)}
        onConfirm={async () => {
          if (cancelling !== null) {
            await cancelInvitation(leagueId, cancelling.id)
            await queryClient.invalidateQueries({ queryKey: invitationsKey })
          }
        }}
      />
    </div>
  )
}
