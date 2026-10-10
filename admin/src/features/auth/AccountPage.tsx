import { useState, type FormEvent } from 'react'
import { changePassword } from '@/api/auth'
import { useSession } from '@/auth/SessionProvider'
import { Button } from '@/ui/Button'
import { Field, FormError } from '@/ui/Field'
import { useSubmit } from '@/ui/useSubmit'
import { PASSWORD_MIN, PASSWORD_RULE } from './password'

export function AccountPage() {
  const { me } = useSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const [done, setDone] = useState(false)
  const { submit, pending, error } = useSubmit(() => changePassword(current, next), {
    403: 'Mot de passe actuel incorrect.',
    422: PASSWORD_RULE,
  })

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setDone(false)
    if (next !== confirm) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    if (await submit()) {
      setDone(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    }
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-xl font-semibold text-slate-900">Mon compte</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">{me?.email}</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Field
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <Field
          label="Confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <FormError message={mismatch ? 'Les mots de passe ne correspondent pas.' : error} />
        {done ? <p className="text-sm text-emerald-800">Mot de passe modifié.</p> : null}
        <Button type="submit" variant="primary" pending={pending}>
          Enregistrer
        </Button>
      </form>
    </div>
  )
}
