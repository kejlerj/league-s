import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Modal } from '@/ui/Modal'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Ouvrir</button>
      <Modal title="Titre" open={open} onClose={() => setOpen(false)}>
        <input aria-label="Premier" />
        <button onClick={() => setOpen(false)}>Fermer</button>
      </Modal>
    </>
  )
}

test("à l'ouverture, le focus va sur le premier champ", async () => {
  render(<Harness />)
  await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
  expect(screen.getByLabelText('Premier')).toHaveFocus()
})

test('Tab reste dans la boîte de dialogue', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
  await user.tab()
  expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
  await user.tab()
  expect(screen.getByLabelText('Premier')).toHaveFocus()
  await user.tab({ shift: true })
  expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
})

test('à la fermeture, le focus revient sur le déclencheur', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ouvrir' })).toHaveFocus()
})
