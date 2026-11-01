import { fireEvent, render, screen } from '@testing-library/react'
import { TeamName } from '@/ui/TeamLogo'

test('a team with a logo shows the image left of its name', () => {
  const { container } = render(<TeamName team={{ name: 'FC Bravo', logo: 'https://img.test/bravo.png' }} />)
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://img.test/bravo.png')
  expect(screen.getByText('FC Bravo')).toBeInTheDocument()
  expect(container.textContent).toBe('FC Bravo')
})

test('a team without a logo shows its initial', () => {
  const { container } = render(<TeamName team={{ name: 'étoile de Charonne', logo: null }} />)
  expect(container.querySelector('img')).toBeNull()
  expect(container.textContent).toBe('Éétoile de Charonne')
})

test('a logo that fails to load falls back to the initial', () => {
  const { container } = render(<TeamName team={{ name: 'AS Alpha', logo: 'https://img.test/broken.png' }} />)
  fireEvent.error(container.querySelector('img')!)
  expect(container.querySelector('img')).toBeNull()
  expect(container.textContent).toBe('AAS Alpha')
})
