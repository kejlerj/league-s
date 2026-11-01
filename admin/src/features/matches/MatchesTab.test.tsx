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

test('the row shows the teams, the score and the local date', async () => {
  setup()
  const live = await rowOf('En cours')
  expect(within(live).getByText('FC Bravo')).toBeInTheDocument()
  expect(within(live).getByText('0 – 0')).toBeInTheDocument()
  const scheduled = await rowOf('Programmé')
  expect(within(scheduled).getByText(/^11\/10\/2026 \d{2}:\d{2}$/)).toBeInTheDocument()
})

test('the match table keeps the same column widths from one season to the next', async () => {
  setup()
  const live = await rowOf('En cours')
  const table = live.closest('table')!
  expect(table).toHaveClass('table-fixed')
  const widths = [...table.querySelectorAll('colgroup col')].map((col) => (col as HTMLElement).style.width)
  expect(widths.filter((width) => width !== '')).toHaveLength(widths.length - 2)
  expect(within(live).getByRole('cell', { name: 'FC Bravo' })).toHaveAttribute('title', 'FC Bravo')
})

test('the most recent match is listed first', async () => {
  mockSeason()
  server.use(
    http.get(`${S}/teams`, () => HttpResponse.json([])),
    http.get(M, () => HttpResponse.json([{ ...matchLive, kickoff_at: '2026-10-04T13:00:00Z' }, matchScheduled])),
  )
  renderRoute('/leagues/L1/seasons/S1?tab=matches', { me: adminOne })
  await rowOf('En cours')
  const statuses = screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[5].textContent)
  expect(statuses).toEqual(['Programmé', 'En cours'])
})

test('each team shows its logo, or its initial without one', async () => {
  mockSeason()
  server.use(
    http.get(`${S}/teams`, () => HttpResponse.json([])),
    http.get(M, () => HttpResponse.json([{ ...matchLive, home_team: { ...matchLive.home_team, logo: 'https://img.test/bravo.png' } }])),
  )
  renderRoute('/leagues/L1/seasons/S1?tab=matches', { me: adminOne })
  const live = await rowOf('En cours')
  expect(within(live).getByRole('cell', { name: 'FC Bravo' }).querySelector('img')).toHaveAttribute('src', 'https://img.test/bravo.png')
  const away = within(live).getByRole('cell', { name: 'AS Alpha' })
  expect(away.querySelector('img')).toBeNull()
  expect(away).toHaveTextContent('AAS Alpha')
})

test('scheduling without kickoff or venue sends nulls', async () => {
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

test('the kickoff entered in local time is sent in UTC', async () => {
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

test('same teams: submitting is blocked', async () => {
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

test('the filters are sent in the request', async () => {
  const queries: URLSearchParams[] = []
  const { user } = setup(queries)
  await rowOf('En cours')
  await user.selectOptions(screen.getByLabelText('Statut'), 'live')
  await vi.waitFor(() => expect(queries.some((q) => q.get('status') === 'live')).toBe(true))
  await user.type(screen.getByLabelText('Journée'), '2')
  await vi.waitFor(() => expect(queries.some((q) => q.get('matchday') === '2' && q.get('status') === 'live')).toBe(true))
})

test('a row has no actions: clicking it opens the match page', async () => {
  const { user } = setup([], http.get(`${M}/M2`, () => HttpResponse.json(matchLive)))
  const live = await rowOf('En cours')
  expect(within(live).queryAllByRole('button')).toHaveLength(0)
  await user.click(within(live).getByRole('cell', { name: 'FC Bravo' }))
  expect(await screen.findByRole('region', { name: 'Match' })).toBeInTheDocument()
})

test('the score of each row is a link to the match page', async () => {
  setup()
  const live = await rowOf('En cours')
  expect(within(live).getByRole('link', { name: 'Ouvrir le match FC Bravo – AS Alpha' })).toHaveAttribute('href', '/leagues/L1/seasons/S1/matches/M2')
})

test('once scheduled, the admin lands on the new match page', async () => {
  const created = { ...matchScheduled, id: 'M7', matchday: 3 }
  const { user } = setup(
    [],
    http.post(M, () => HttpResponse.json(created, { status: 201 })),
    http.get(`${M}/M7`, () => HttpResponse.json(created)),
  )
  await user.click(await screen.findByRole('button', { name: 'Programmer un match' }))
  const dialog = screen.getByRole('dialog')
  await user.selectOptions(within(dialog).getByLabelText('Domicile'), 'T1')
  await user.selectOptions(within(dialog).getByLabelText('Extérieur'), 'T2')
  await user.type(within(dialog).getByLabelText('Journée'), '3')
  await user.click(within(dialog).getByRole('button', { name: 'Programmer' }))
  const header = await screen.findByRole('region', { name: 'Match' })
  expect(within(header).getByText(/Journée 3/)).toBeInTheDocument()
})
