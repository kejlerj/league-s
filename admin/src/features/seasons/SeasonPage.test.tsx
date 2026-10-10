import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { adminOne, mockSeason, teamA, teamB } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

const S = `${API}/leagues/L1/seasons/S1`
const registered = [{ id: 'T1', name: 'AS Alpha', logo: null }]

function setup(tab = 'teams', ...handlers: Parameters<typeof server.use>) {
  mockSeason()
  server.use(
    http.get(`${S}/teams`, () => HttpResponse.json(registered)),
    http.get(`${API}/leagues/L1/teams`, () => HttpResponse.json([teamA, teamB])),
    ...handlers,
  )
  return renderRoute(`/leagues/L1/seasons/S1?tab=${tab}`, { me: adminOne })
}

test('affiche la saison, le retour à la ligue et les trois onglets', async () => {
  setup()
  expect(await screen.findByRole('heading', { name: '2026-2027' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Retour à la ligue' })).toHaveAttribute('href', '/leagues/L1?tab=seasons')
  for (const label of ['Équipes', 'Matchs', 'Classement']) {
    expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
  }
})

test("une équipe inscrite mène à son effectif", async () => {
  setup()
  expect(await screen.findByRole('link', { name: 'AS Alpha' })).toHaveAttribute(
    'href',
    '/leagues/L1/seasons/S1/teams/T1',
  )
})

test('la liste ne propose que les équipes non inscrites et inscrit la bonne', async () => {
  let called = ''
  server.use(
    http.post(`${S}/teams/:teamId`, ({ params }) => {
      called = String(params.teamId)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { user } = setup()
  const select = await screen.findByLabelText('Inscrire une équipe')
  await vi.waitFor(() => expect(within(select).getByRole('option', { name: 'FC Bravo' })).toBeInTheDocument())
  expect(within(select).queryByRole('option', { name: 'AS Alpha' })).not.toBeInTheDocument()
  await user.selectOptions(select, 'T2')
  await user.click(screen.getByRole('button', { name: 'Inscrire' }))
  await vi.waitFor(() => expect(called).toBe('T2'))
})

test('désinscription refusée', async () => {
  server.use(http.delete(`${S}/teams/T1`, () => HttpResponse.json({ error: 'x' }, { status: 409 })))
  const { user } = setup()
  const row = (await screen.findByRole('link', { name: 'AS Alpha' })).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Désinscrire' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Désinscrire' }))
  expect(await screen.findByText('Cette équipe a des matchs dans la saison.')).toBeInTheDocument()
})

test('le classement affiche une ligne complète', async () => {
  setup(
    'standings',
    http.get(`${S}/standings`, () =>
      HttpResponse.json([
        {
          rank: 1, team_id: 'T1', team_name: 'AS Alpha', played: 12, won: 8, drawn: 3, lost: 1,
          goals_for: 27, goals_against: 9, goal_difference: 18, points: 26,
        },
      ]),
    ),
  )
  const row = (await screen.findByText('AS Alpha')).closest('tr')!
  const cells = within(row).getAllByRole('cell').map((cell) => cell.textContent)
  expect(cells).toEqual(['1', 'AS Alpha', '12', '8', '3', '1', '27', '9', '+18', '26'])
  const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
  expect(headers).toEqual(['#', 'Équipe', 'J', 'G', 'N', 'P', 'BP', 'BC', 'Diff', 'Pts'])
})

test('classement vide', async () => {
  setup('standings')
  expect(await screen.findByText('Aucun match terminé.')).toBeInTheDocument()
})

test("la saison d'une ligue non administrée est refusée", async () => {
  renderRoute('/leagues/L2/seasons/S9', { me: adminOne })
  expect(await screen.findByText('Accès refusé.')).toBeInTheDocument()
})
