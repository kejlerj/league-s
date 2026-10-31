import { screen } from '@testing-library/react'
import { renderRoute } from '@/test/render'

test('renderRoute affiche la route demandée', async () => {
  renderRoute('/login', { me: null })
  expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
})
