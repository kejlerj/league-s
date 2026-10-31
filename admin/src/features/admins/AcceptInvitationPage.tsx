import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { acceptInvitation, lookupInvitation } from '@/api/admins'
import { ApiError } from '@/api/client'
import type { InvitationPreview } from '@/api/types'
import { AuthCard } from '@/features/auth/AuthCard'
import { INVALID_LINK, PASSWORD_MIN, PASSWORD_RULE } from '@/features/auth/password'
import { Button } from '@/ui/Button'
import { errorMessage } from '@/ui/errorMessage'
import { Field, FormError } from '@/ui/Field'
import { useSubmit } from '@/ui/useSubmit'

function AcceptForm({ token, preview }: { token: string; preview: InvitationPreview }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const { submit, pending, error } = useSubmit(
    () => acceptInvitation(token, preview.account_exists ? undefined : { name: name.trim(), password }),
    { 400: INVALID_LINK, 422: PASSWORD_RULE },
  )

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      setDone(true)
    }
  }

  if (done) {
    return (
      <>
        <p className="mb-4 text-sm text-slate-700">C'est fait. Vous pouvez vous connecter.</p>
        <Link to="/login" className="text-sm text-emerald-800 underline-offset-2 hover:underline">
          Se connecter
        </Link>
      </>
    )
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-slate-700">
        Invitation pour <span className="font-medium">{preview.email}</span>
      </p>
      {preview.account_exists ? (
        <p className="text-sm text-slate-700">Un compte existe déjà pour cette adresse. La ligue y sera ajoutée.</p>
      ) : (
        <>
          <Field label="Nom" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field
            label="Mot de passe"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </>
      )}
      <FormError message={error} />
      <Button type="submit" variant="primary" pending={pending} className="w-full">
        {preview.account_exists ? 'Rejoindre la ligue' : 'Créer mon compte'}
      </Button>
    </form>
  )
}

export function AcceptInvitationPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const query = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => lookupInvitation(token),
    enabled: token !== '',
    staleTime: Infinity,
  })

  if (token === '') {
    return (
      <AuthCard title="Invitation">
        <p className="text-sm text-slate-700">{INVALID_LINK}</p>
      </AuthCard>
    )
  }
  if (query.isPending) {
    return (
      <AuthCard title="Invitation">
        <p className="text-sm text-slate-500">Chargement…</p>
      </AuthCard>
    )
  }
  if (query.isError) {
    const invalid = query.error instanceof ApiError && (query.error.status === 400 || query.error.status === 404)
    return (
      <AuthCard title="Invitation">
        <p className="text-sm text-slate-700">{invalid ? INVALID_LINK : errorMessage(query.error)}</p>
        {invalid ? null : (
          <Button className="mt-4" onClick={() => void query.refetch()}>
            Réessayer
          </Button>
        )}
      </AuthCard>
    )
  }
  return (
    <AuthCard title={`Rejoindre ${query.data.league.name}`}>
      <AcceptForm token={token} preview={query.data} />
    </AuthCard>
  )
}
