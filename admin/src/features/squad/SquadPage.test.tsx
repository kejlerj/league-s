import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { today } from '@/lib/dates'
import { adminOne, mockSeason, playerP1, playerP2 } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

const S = `${API}/leagues/L1/seasons/S1`
const SQUAD = `${S}/teams/T1/squad`
const member = {
  membership_id: 'M1',
  player_id: 'P1',
  firstname: 'Léo',
  lastname: 'Dupont',
  icon: null,
  number: 7,
  joined_on: '2026-09-01',
  left_on: null,
}
const gone = { ...member, membership_id: 'M0', player_id: 'P9', firstname: 'Ancien', lastname: 'Parti', number: null, left_on: '2026-09-20' }

function setup(alls: (string | null)[] = [], ...handlers: Parameters<typeof server.use>) {
  mockSeason()
  server.use(
    http.get(`${S}/teams`, () =>
      HttpResponse.json([
        { id: 'T1', name: 'AS Alpha', logo: null },
        { id: 'T2', name: 'FC Bravo', logo: null },
      ]),
    ),
    http.get(SQUAD, ({ request }) => {
      const all = new URL(request.url).searchParams.get('all')
      alls.push(all)
      return HttpResponse.json(all === 'true' ? [member, gone] : [member])
    }),
    http.get(`${S}/teams/T2/squad`, () => HttpResponse.json([])),
    http.get(`${API}/leagues/L1/players`, () => HttpResponse.json([playerP1, playerP2])),
    ...handlers,
  )
  return renderRoute('/leagues/L1/seasons/S1/teams/T1', { me: adminOne })
}

function capture(target: { body?: unknown }, status = 204) {
  return async ({ request }: { request: Request }) => {
    target.body = await request.json()
    return status === 204 ? new HttpResponse(null, { status }) : HttpResponse.json({}, { status })
  }
}

test("affiche l'effectif et le nom de l'équipe", async () => {
  setup()
  expect(await screen.findByRole('heading', { name: 'AS Alpha' })).toBeInTheDocument()
  const row = (await screen.findByText('Léo Dupont')).closest('tr')!
  expect(within(row).getByText('7')).toBeInTheDocument()
  expect(within(row).getByText('01/09/2026')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Retour à la saison' })).toHaveAttribute('href', '/leagues/L1/seasons/S1')
})

test('Afficher les départs recharge avec all=true', async () => {
  const alls: (string | null)[] = []
  const { user } = setup(alls)
  await screen.findByText('Léo Dupont')
  expect(alls).toEqual([null])
  await user.click(screen.getByLabelText('Afficher les départs'))
  expect(await screen.findByText('Ancien Parti')).toBeInTheDocument()
  expect(alls).toContain('true')
})

test('entrée : numéro vide en null, date au format YYYY-MM-DD, joueurs déjà présents exclus', async () => {
  const sent: { body?: unknown } = {}
  const { user } = setup([], http.post(SQUAD, capture(sent, 201)))
  await user.click(await screen.findByRole('button', { name: 'Ajouter un joueur' }))
  const dialog = screen.getByRole('dialog')
  const select = within(dialog).getByLabelText('Joueur')
  await vi.waitFor(() => expect(within(select).getByRole('option', { name: 'Max Durand' })).toBeInTheDocument())
  expect(within(select).queryByRole('option', { name: 'Léo Dupont' })).not.toBeInTheDocument()
  await user.selectOptions(select, 'P2')
  await user.click(within(dialog).getByRole('button', { name: 'Ajouter' }))
  await vi.waitFor(() => expect(sent.body).toEqual({ player_id: 'P2', number: null, joined_on: today() }))
})

test("entrée refusée : le message de l'API s'affiche", async () => {
  const { user } = setup(
    [],
    http.post(SQUAD, () => HttpResponse.json({ error: 'player already in a squad this season' }, { status: 409 })),
  )
  await user.click(await screen.findByRole('button', { name: 'Ajouter un joueur' }))
  const dialog = screen.getByRole('dialog')
  const select = within(dialog).getByLabelText('Joueur')
  await vi.waitFor(() => expect(within(select).getByRole('option', { name: 'Max Durand' })).toBeInTheDocument())
  await user.selectOptions(select, 'P2')
  await user.click(within(dialog).getByRole('button', { name: 'Ajouter' }))
  expect(await screen.findByText('player already in a squad this season')).toBeInTheDocument()
})

test('changement de numéro', async () => {
  const sent: { body?: unknown } = {}
  const { user } = setup([], http.patch(`${SQUAD}/M1`, capture(sent, 200)))
  const row = (await screen.findByText('Léo Dupont')).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Numéro' }))
  const dialog = screen.getByRole('dialog')
  const input = within(dialog).getByLabelText('Numéro')
  expect(input).toHaveValue(7)
  await user.clear(input)
  await user.type(input, '9')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toEqual({ number: 9 }))
})

test('départ', async () => {
  const sent: { body?: unknown } = {}
  const { user } = setup([], http.post(`${SQUAD}/M1/leave`, capture(sent, 200)))
  const row = (await screen.findByText('Léo Dupont')).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Départ' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toEqual({ left_on: today() }))
})

test("transfert : part de l'équipe courante, qui n'est pas proposée en destination", async () => {
  const sent: { body?: unknown } = {}
  const { user } = setup([], http.post(`${S}/transfers`, capture(sent, 201)))
  const row = (await screen.findByText('Léo Dupont')).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Transférer' }))
  const dialog = screen.getByRole('dialog')
  const select = within(dialog).getByLabelText('Vers')
  expect(within(select).queryByRole('option', { name: 'AS Alpha' })).not.toBeInTheDocument()
  await user.selectOptions(select, 'T2')
  await user.click(within(dialog).getByRole('button', { name: 'Transférer' }))
  await vi.waitFor(() =>
    expect(sent.body).toEqual({ player_id: 'P1', from_team_id: 'T1', to_team_id: 'T2', number: null, on: today() }),
  )
})

test('un joueur parti n\'a plus d\'actions', async () => {
  const { user } = setup()
  await screen.findByText('Léo Dupont')
  await user.click(screen.getByLabelText('Afficher les départs'))
  const row = (await screen.findByText('Ancien Parti')).closest('tr')!
  expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  expect(within(row).getByText('20/09/2026')).toBeInTheDocument()
})

test("un joueur déjà dans une autre équipe de la saison n'est pas proposé, et le formulaire dit quoi faire", async () => {
  const { user } = setup()
  server.use(http.get(`${S}/teams/T2/squad`, () => HttpResponse.json([{ ...member, membership_id: 'M2', player_id: 'P2' }])))
  await screen.findByText('Léo Dupont')
  await user.click(screen.getByRole('button', { name: 'Ajouter un joueur' }))
  const dialog = screen.getByRole('dialog')
  expect(await within(dialog).findByText(/Tous les joueurs de la ligue sont déjà dans un effectif cette saison/)).toBeInTheDocument()
  expect(within(dialog).queryByRole('option', { name: 'Max Durand' })).not.toBeInTheDocument()
  expect(within(dialog).getByRole('link', { name: 'Joueurs' })).toHaveAttribute('href', '/leagues/L1?tab=players')
})
