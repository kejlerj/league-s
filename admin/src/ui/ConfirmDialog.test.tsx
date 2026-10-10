import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/api/client'
import { ConfirmDialog } from '@/ui/ConfirmDialog'

test("ConfirmDialog reste ouvert et montre l'erreur si onConfirm échoue", async () => {
  const onClose = vi.fn()
  render(
    <ConfirmDialog
      open
      title="Supprimer la ligue"
      message="Sûr ?"
      confirmLabel="Supprimer"
      onConfirm={() => Promise.reject(new ApiError(409, 'x'))}
      onClose={onClose}
      errorOverrides={{ 409: 'Cette ligue a un historique.' }}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
  expect(await screen.findByText('Cette ligue a un historique.')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('ConfirmDialog se ferme après succès', async () => {
  const onClose = vi.fn()
  const onConfirm = vi.fn(() => Promise.resolve())
  render(
    <ConfirmDialog open title="Supprimer" message="Sûr ?" confirmLabel="Oui" onConfirm={onConfirm} onClose={onClose} />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Oui' }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('ConfirmDialog fermé ne rend rien', () => {
  render(
    <ConfirmDialog open={false} title="T" message="M" confirmLabel="Oui" onConfirm={() => Promise.resolve()} onClose={() => {}} />,
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
