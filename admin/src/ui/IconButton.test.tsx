import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pencil, Trash2 } from 'lucide-react'
import { IconButton } from '@/ui/IconButton'

test('the button is named by its label and runs its action', async () => {
  const onClick = vi.fn()
  render(<IconButton label="Modifier" icon={Pencil} onClick={onClick} />)
  await userEvent.click(screen.getByRole('button', { name: 'Modifier' }))
  expect(onClick).toHaveBeenCalledOnce()
})

test('the tooltip shows at once on hover and hides on leave', async () => {
  const user = userEvent.setup()
  render(<IconButton label="Modifier" icon={Pencil} onClick={() => {}} />)
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  await user.hover(screen.getByRole('button', { name: 'Modifier' }))
  expect(screen.getByRole('tooltip')).toHaveTextContent('Modifier')
  await user.unhover(screen.getByRole('button', { name: 'Modifier' }))
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

test('the tooltip shows on keyboard focus', async () => {
  const user = userEvent.setup()
  render(<IconButton label="Supprimer" icon={Trash2} danger onClick={() => {}} />)
  await user.tab()
  expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveFocus()
  expect(screen.getByRole('tooltip')).toHaveTextContent('Supprimer')
  await user.tab()
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

test('a danger action is red', () => {
  render(<IconButton label="Supprimer" icon={Trash2} danger onClick={() => {}} />)
  expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveClass('text-red-700')
})
