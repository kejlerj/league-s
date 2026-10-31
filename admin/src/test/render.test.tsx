import { screen } from '@testing-library/react'
import { renderRoute } from '@/test/render'

test('renderRoute renders the requested route', async () => {
  renderRoute('/login', { me: null })
  expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
})
