import { Button } from './Button'
import { FormError } from './Field'
import { Modal } from './Modal'
import { useSubmit } from './useSubmit'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => Promise<unknown>
  onClose: () => void
  errorOverrides?: Record<number, string>
  danger?: boolean
}

function ConfirmBody({ message, confirmLabel, onConfirm, onClose, errorOverrides, danger = true }: Omit<Props, 'open' | 'title'>) {
  const { submit, pending, error } = useSubmit(onConfirm, errorOverrides)

  const confirm = async () => {
    if (await submit()) {
      onClose()
    }
  }

  return (
    <>
      <p className="text-sm text-slate-700">{message}</p>
      <div className="mt-3">
        <FormError message={error} />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose}>Fermer</Button>
        <Button variant={danger ? 'danger' : 'primary'} pending={pending} onClick={confirm}>
          {confirmLabel}
        </Button>
      </div>
    </>
  )
}

export function ConfirmDialog({ open, title, onClose, ...body }: Props) {
  return (
    <Modal title={title} open={open} onClose={onClose}>
      {open ? <ConfirmBody onClose={onClose} {...body} /> : null}
    </Modal>
  )
}
