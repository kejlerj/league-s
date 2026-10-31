import { useState, type FormEvent } from 'react'
import { createPlayer, updatePlayer } from '@/api/players'
import type { Player } from '@/api/types'
import { emptyToNull } from '@/lib/form'
import { Field } from '@/ui/Field'
import { FormActions } from '@/ui/FormActions'
import { useSubmit } from '@/ui/useSubmit'

type Props = { leagueId: string; initial?: Player; onDone: () => void; onCancel: () => void }

export function PlayerForm({ leagueId, initial, onDone, onCancel }: Props) {
  const [firstname, setFirstname] = useState(initial?.firstname ?? '')
  const [lastname, setLastname] = useState(initial?.lastname ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '')
  const { submit, pending, error } = useSubmit(() => {
    const input = { firstname: firstname.trim(), lastname: lastname.trim(), icon: emptyToNull(icon) }
    return initial ? updatePlayer(leagueId, initial.id, input) : createPlayer(leagueId, input)
  })

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (await submit()) {
      onDone()
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Prénom" required maxLength={50} value={firstname} onChange={(e) => setFirstname(e.target.value)} />
      <Field label="Nom" required maxLength={50} value={lastname} onChange={(e) => setLastname(e.target.value)} />
      <Field label="Photo (URL)" type="url" value={icon} onChange={(e) => setIcon(e.target.value)} />
      <FormActions error={error} pending={pending} onCancel={onCancel} />
    </form>
  )
}
