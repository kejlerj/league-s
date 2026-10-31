import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { adminOne, leagueL1, mockLeague, teamA, teamB } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

function setup() {
  mockLeague(leagueL1)
  server.use(http.get(`${API}/leagues/L1/teams`, () => HttpResponse.json([teamA, teamB])))
  return renderRoute('/leagues/L1?tab=teams', { me: adminOne })
}

test('lists the teams', async () => {
  setup()
  expect(await screen.findByText('AS Alpha')).toBeInTheDocument()
  expect(screen.getByText('FC Bravo')).toBeInTheDocument()
})

test('create: an empty logo is sent as null', async () => {
  let body: unknown
  server.use(
    http.post(`${API}/leagues/L1/teams`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...teamA, id: 'T3', name: 'US Charlie' }, { status: 201 })
    }),
  )
  const { user } = setup()
  await user.click(await screen.findByRole('button', { name: 'Nouvelle équipe' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom'), 'US Charlie')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(body).toEqual({ name: 'US Charlie', logo: null }))
})

test('edit: PATCH without the logo key when it is empty', async () => {
  let body: unknown
  server.use(
    http.patch(`${API}/leagues/L1/teams/T1`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...teamA, name: 'AS Alpha B' })
    }),
  )
  const { user } = setup()
  const row = (await screen.findByText('AS Alpha')).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Modifier' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom'), ' B')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(body).toEqual({ name: 'AS Alpha B' }))
})

test('delete refused', async () => {
  server.use(http.delete(`${API}/leagues/L1/teams/T1`, () => HttpResponse.json({ error: 'x' }, { status: 409 })))
  const { user } = setup()
  const row = (await screen.findByText('AS Alpha')).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Supprimer' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
  expect(await screen.findByText('Cette équipe a un historique.')).toBeInTheDocument()
})

test('a 422 shows each message under its field, and editing a field clears its message', async () => {
  server.use(
    http.post(`${API}/leagues/L1/teams`, () =>
      HttpResponse.json(
        { errors: { name: '50 caractères maximum', logo: 'doit être une URL http ou https' } },
        { status: 422 },
      ),
    ),
  )
  const { user } = setup()
  await user.click(await screen.findByRole('button', { name: 'Nouvelle équipe' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom'), 'US Charlie')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

  const name = within(dialog).getByLabelText('Nom')
  const logo = within(dialog).getByLabelText('Logo (URL)')
  expect(await within(dialog).findByText('50 caractères maximum')).toBeInTheDocument()
  expect(name).toHaveAccessibleDescription('50 caractères maximum')
  expect(name).toBeInvalid()
  expect(logo).toHaveAccessibleDescription('doit être une URL http ou https')
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()

  await user.type(name, 'x')
  expect(name).not.toHaveAccessibleDescription()
  expect(logo).toHaveAccessibleDescription('doit être une URL http ou https')
})

test('an unknown league answers 404 on the list, and the tab shows Introuvable.', async () => {
  mockLeague(leagueL1)
  server.use(http.get(`${API}/leagues/L1/teams`, () => HttpResponse.json({ error: 'league not found' }, { status: 404 })))
  renderRoute('/leagues/L1?tab=teams', { me: adminOne })
  expect(await screen.findByText('Introuvable.')).toBeInTheDocument()
})
