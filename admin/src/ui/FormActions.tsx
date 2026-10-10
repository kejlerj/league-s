import { Button } from './Button'
import { FormError } from './Field'

type Props = { error: string | null; pending: boolean; onCancel: () => void; submitLabel?: string }

export function FormActions({ error, pending, onCancel, submitLabel = 'Enregistrer' }: Props) {
  return (
    <>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Fermer</Button>
        <Button type="submit" variant="primary" pending={pending}>
          {submitLabel}
        </Button>
      </div>
    </>
  )
}
