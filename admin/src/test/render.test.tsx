import { screen } from '@testing-library/react'
import { renderRoute } from '@/test/render'

test('renderRoute affiche la route demandée', async () => {
  renderRoute('/')
  expect(await screen.findByText('Admin')).toBeInTheDocument()
})
