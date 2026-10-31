import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { login } from '@/api/auth'
import { useSession } from '@/auth/SessionProvider'
import { Button } from '@/ui/Button'
import { Field, FormError } from '@/ui/Field'
import { useSubmit } from '@/ui/useSubmit'
import { AuthCard } from './AuthCard'

type LocationState = { from?: { pathname: string; search: string } } | null

export function LoginPage() {
  const { me, loading, refresh } = useSession()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { submit, pending, error, field } = useSubmit(
    async () => {
      await login(email, password)
      await refresh()
    },
    { 401: 'E-mail ou mot de passe incorrect.' },
  )

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">Chargement…</p>
  }
  if (me !== null) {
    const from = (location.state as LocationState)?.from
    return <Navigate to={from ? `${from.pathname}${from.search}` : '/'} replace />
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit()
  }

  return (
    <AuthCard title="Connexion">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="E-mail" {...field('email')} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Mot de passe"
          {...field('password')}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" variant="primary" pending={pending} className="w-full">
          Se connecter
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-emerald-800 underline-offset-2 hover:underline">
            Mot de passe oublié ?
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
