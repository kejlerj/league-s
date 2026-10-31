import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { confirmPasswordReset } from '@/api/auth'
import { Button } from '@/ui/Button'
import { Field, FormError } from '@/ui/Field'
import { useSubmit } from '@/ui/useSubmit'
import { AuthCard } from './AuthCard'
import { INVALID_LINK, PASSWORD_MIN, PASSWORD_RULE } from './password'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const { submit, pending, error, field } = useSubmit(() => confirmPasswordReset(token, password), {
    400: INVALID_LINK,
    422: PASSWORD_RULE,
  })

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      setDone(true)
    }
  }

  const loginLink = (
    <Link to="/login" className="text-emerald-800 underline-offset-2 hover:underline">
      Se connecter
    </Link>
  )

  if (token === '') {
    return (
      <AuthCard title="Nouveau mot de passe">
        <p className="text-sm text-slate-700">{INVALID_LINK}</p>
      </AuthCard>
    )
  }
  if (done) {
    return (
      <AuthCard title="Nouveau mot de passe">
        <p className="mb-4 text-sm text-slate-700">Mot de passe modifié.</p>
        <p className="text-sm">{loginLink}</p>
      </AuthCard>
    )
  }
  return (
    <AuthCard title="Nouveau mot de passe">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Nouveau mot de passe"
          {...field('password')}
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" variant="primary" pending={pending} className="w-full">
          Enregistrer
        </Button>
      </form>
    </AuthCard>
  )
}
