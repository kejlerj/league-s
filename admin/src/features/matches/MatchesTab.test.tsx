import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { localToUtc } from '@/lib/dates'
import { adminOne, matchLive, matchScheduled, mockSeason } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

const S = `${API}/leagues/L1/seasons/S1`
const M = `${S}/matches`

type Sent = { body?: unknown; calls: number }

function capture(target: Sent, response: () => Response = () => HttpResponse.json(matchScheduled)) {
  return async ({ request }: { request: Request }) => {
    target.calls += 1
    target.body = await request.json().catch(() => undefined)
    return response()
  }
}

function setup(queries: URLSearchParams[] = [], ...handlers: Parameters<typeof server.use>) {
  mockSeason()
  server.use(
    http.get(`${S}/teams`, () =>
      HttpResponse.json([
        { id: 'T1', name: 'AS Alpha', logo: null },
        { id: 'T2', name: 'FC Bravo', logo: null },
      ]),
    ),
    http.get(M, ({ request }) => {
      queries.push(new URL(request.url).searchParams)
      return HttpResponse.json([matchLive, matchScheduled])
    }),
    ...handlers,
  )
  return renderRoute('/leagues/L1/seasons/S1?tab=matches', { me: adminOne })
}

async function rowOf(status: string) {
  const cell = await screen.findByRole('cell', { name: status })
  return cell.closest('tr')!
}

test('les actions dépendent du statut', async () => {
  setup()
  const live = await rowOf('En cours')
  expect(within(live).getByRole('button', { name: 'Score' })).toBeInTheDocument()
  expect(within(live).getByRole('button', { name: 'Terminer' })).toBeInTheDocument()
  expect(within(live).queryByRole('button', { name: 'Démarrer' })).not.toBeInTheDocument()
  const scheduled = await rowOf('Programmé')
  expect(within(scheduled).getByRole('button', { name: 'Démarrer' })).toBeInTheDocument()
  expect(within(scheduled).queryByRole('button', { name: 'Score' })).not.toBeInTheDocument()
})

test('la ligne affiche les équipes, le score et la date locale', async () => {
  setup()
  const live = await rowOf('En cours')
  expect(within(live).getByText('FC Bravo')).toBeInTheDocument()
  expect(within(live).getByText('0 – 0')).toBeInTheDocument()
  const scheduled = await rowOf('Programmé')
  expect(within(scheduled).getByText(/^11\/10\/2026 \d{2}:\d{2}$/)).toBeInTheDocument()
})

test('saisie du score', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = setup([], http.put(`${M}/M2/score`, capture(sent)))
  await user.click(within(await rowOf('En cours')).getByRole('button', { name: 'Score' }))
  const dialog = screen.getByRole('dialog')
  const home = within(dialog).getByLabelText('FC Bravo')
  const away = within(dialog).getByLabelText('AS Alpha')
  await user.clear(home)
  await user.type(home, '2')
  await user.clear(away)
  await user.type(away, '1')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toEqual({ home: 2, away: 1 }))
})

test('programmer sans coup d\'envoi ni lieu envoie des null', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = setup([], http.post(M, capture(sent)))
  await user.click(await screen.findByRole('button', { name: 'Programmer un match' }))
  const dialog = screen.getByRole('dialog')
  await user.selectOptions(within(dialog).getByLabelText('Domicile'), 'T1')
  await user.selectOptions(within(dialog).getByLabelText('Extérieur'), 'T2')
  await user.type(within(dialog).getByLabelText('Journée'), '3')
  await user.click(within(dialog).getByRole('button', { name: 'Programmer' }))
  await vi.waitFor(() =>
    expect(sent.body).toEqual({ home_team_id: 'T1', away_team_id: 'T2', matchday: 3, kickoff_at: null, venue: null }),
  )
})

test('le coup d\'envoi saisi en heure locale part en UTC', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = setup([], http.post(M, capture(sent)))
  await user.click(await screen.findByRole('button', { name: 'Programmer un match' }))
  const dialog = screen.getByRole('dialog')
  await user.selectOptions(within(dialog).getByLabelText('Domicile'), 'T1')
  await user.selectOptions(within(dialog).getByLabelText('Extérieur'), 'T2')
  await user.type(within(dialog).getByLabelText('Journée'), '3')
  await user.type(within(dialog).getByLabelText("Coup d'envoi"), '2026-10-11T15:00')
  await user.type(within(dialog).getByLabelText('Lieu'), 'Stade Sud')
  await user.click(within(dialog).getByRole('button', { name: 'Programmer' }))
  await vi.waitFor(() =>
    expect(sent.body).toMatchObject({ kickoff_at: localToUtc('2026-10-11T15:00'), venue: 'Stade Sud' }),
  )
})

test("mêmes équipes : l'envoi est bloqué", async () => {
  const sent: Sent = { calls: 0 }
  const { user } = setup([], http.post(M, capture(sent)))
  await user.click(await screen.findByRole('button', { name: 'Programmer un match' }))
  const dialog = screen.getByRole('dialog')
  await user.selectOptions(within(dialog).getByLabelText('Domicile'), 'T1')
  await user.selectOptions(within(dialog).getByLabelText('Extérieur'), 'T1')
  await user.type(within(dialog).getByLabelText('Journée'), '3')
  await user.click(within(dialog).getByRole('button', { name: 'Programmer' }))
  expect(await screen.findByText('Les deux équipes doivent être différentes.')).toBeInTheDocument()
  expect(sent.calls).toBe(0)
})

test('les filtres partent dans la requête', async () => {
  const queries: URLSearchParams[] = []
  const { user } = setup(queries)
  await rowOf('En cours')
  await user.selectOptions(screen.getByLabelText('Statut'), 'live')
  await vi.waitFor(() => expect(queries.some((q) => q.get('status') === 'live')).toBe(true))
  await user.type(screen.getByLabelText('Journée'), '2')
  await vi.waitFor(() => expect(queries.some((q) => q.get('matchday') === '2' && q.get('status') === 'live')).toBe(true))
})

test('Détails : un champ vide est absent du corps', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = setup([], http.patch(`${M}/M1`, capture(sent)))
  await user.click(within(await rowOf('Programmé')).getByRole('button', { name: 'Détails' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Lieu'), 'Stade Nord')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toEqual({ venue: 'Stade Nord' }))
})

test('Reprogrammer envoie la journée et le coup d\'envoi', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = setup([], http.patch(`${M}/M1`, capture(sent)))
  await user.click(within(await rowOf('Programmé')).getByRole('button', { name: 'Reprogrammer' }))
  const dialog = screen.getByRole('dialog')
  const matchday = within(dialog).getByLabelText('Journée')
  expect(matchday).toHaveValue(1)
  await user.clear(matchday)
  await user.type(matchday, '4')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toEqual({ matchday: 4, kickoff_at: '2026-10-11T13:00:00.000Z' }))
})

test('Démarrer appelle start, et une erreur de l\'API s\'affiche', async () => {
  const { user } = setup(
    [],
    http.post(`${M}/M1/start`, () => HttpResponse.json({ error: 'match is not scheduled' }, { status: 409 })),
  )
  await user.click(within(await rowOf('Programmé')).getByRole('button', { name: 'Démarrer' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Démarrer' }))
  expect(await screen.findByText('match is not scheduled')).toBeInTheDocument()
})

test('Reporter sans nouvelle date envoie un corps vide', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = setup([], http.post(`${M}/M1/postpone`, capture(sent)))
  await user.click(within(await rowOf('Programmé')).getByRole('button', { name: 'Reporter' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reporter' }))
  await vi.waitFor(() => expect(sent.body).toEqual({}))
})

test('Terminer demande confirmation puis appelle finish', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = setup([], http.post(`${M}/M2/finish`, capture(sent)))
  await user.click(within(await rowOf('En cours')).getByRole('button', { name: 'Terminer' }))
  expect(sent.calls).toBe(0)
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Terminer' }))
  await vi.waitFor(() => expect(sent.calls).toBe(1))
})
