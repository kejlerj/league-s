import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { requestPasswordReset } from '@/api/auth'
import { Button } from '@/ui/Button'
import { Field, FormError } from '@/ui/Field'
import { useSubmit } from '@/ui/useSubmit'
import { AuthCard } from './AuthCard'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const { submit, pending, error } = useSubmit(() => requestPasswordReset(email))

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      setSent(true)
    }
  }

  return (
    <AuthCard title="Mot de passe oublié">
      {sent ? (
        <p className="text-sm text-slate-700">Si un compte existe pour cette adresse, un e-mail vient d'être envoyé.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} />
          <Button type="submit" variant="primary" pending={pending} className="w-full">
            Envoyer le lien
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-emerald-800 underline-offset-2 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </AuthCard>
  )
}
