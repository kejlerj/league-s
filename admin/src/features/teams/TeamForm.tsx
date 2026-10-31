import { useState, type FormEvent } from 'react'
import { createTeam, updateTeam } from '@/api/teams'
import type { Team } from '@/api/types'
import { emptyToNull } from '@/lib/form'
import { Field } from '@/ui/Field'
import { FormActions } from '@/ui/FormActions'
import { useSubmit } from '@/ui/useSubmit'

type Props = { leagueId: string; initial?: Team; onDone: () => void; onCancel: () => void }

export function TeamForm({ leagueId, initial, onDone, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [logo, setLogo] = useState(initial?.logo ?? '')
  const { submit, pending, error, field } = useSubmit(() => {
    const input = { name: name.trim(), logo: emptyToNull(logo) }
    return initial ? updateTeam(leagueId, initial.id, input) : createTeam(leagueId, input)
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
      <FormActions error={error} pending={pending} onCancel={onCancel} />
    </form>
  )
}
