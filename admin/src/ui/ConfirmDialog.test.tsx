import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/api/client'
import { ConfirmDialog } from '@/ui/ConfirmDialog'

test('ConfirmDialog stays open and shows the error when onConfirm fails', async () => {
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

test('ConfirmDialog closes after a success', async () => {
  const onClose = vi.fn()
  const onConfirm = vi.fn(() => Promise.resolve())
  render(
    <ConfirmDialog open title="Supprimer" message="Sûr ?" confirmLabel="Oui" onConfirm={onConfirm} onClose={onClose} />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Oui' }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('a closed ConfirmDialog renders nothing', () => {
  render(
    <ConfirmDialog open={false} title="T" message="M" confirmLabel="Oui" onConfirm={() => Promise.resolve()} onClose={() => {}} />,
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('a reopened ConfirmDialog does not show the previous error', async () => {
  const props = {
    title: 'Supprimer',
    message: 'Sûr ?',
    confirmLabel: 'Oui',
    onConfirm: () => Promise.reject(new ApiError(409, 'refusé')),
    onClose: () => {},
  }
  const { rerender } = render(<ConfirmDialog open {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'Oui' }))
  expect(await screen.findByText('refusé')).toBeInTheDocument()
  rerender(<ConfirmDialog open={false} {...props} />)
  rerender(<ConfirmDialog open {...props} />)
  expect(screen.queryByText('refusé')).not.toBeInTheDocument()
})
