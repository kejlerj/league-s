import { useState, type FormEvent } from 'react'
import { createLeague, updateLeague } from '@/api/leagues'
import type { League } from '@/api/types'
import { emptyToNull } from '@/lib/form'
import { Button } from '@/ui/Button'
import { Field, FormError } from '@/ui/Field'
import { useSubmit } from '@/ui/useSubmit'

type Props = {
  initial?: League
  onDone: () => void
  onCancel: () => void
}

export function LeagueForm({ initial, onDone, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [logo, setLogo] = useState(initial?.logo ?? '')
  const { submit, pending, error, field } = useSubmit(() => {
    const input = { name: name.trim(), logo: emptyToNull(logo) }
    return initial ? updateLeague(initial.id, input) : createLeague(input)
  })

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      onDone()
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Nom" {...field('name')} required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="Logo (URL)" {...field('logo')} type="url" value={logo} onChange={(e) => setLogo(e.target.value)} />
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Fermer</Button>
        <Button type="submit" variant="primary" pending={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
