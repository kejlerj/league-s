import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { Match, MatchEvent, MatchStatus, SquadMember } from '@/api/types'
import { adminOne, matchLive, mockSeason } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

const S = `${API}/leagues/L1/seasons/S1`
const M = `${S}/matches/M2`

const live: Match = { ...matchLive, kickoff_at: '2026-10-11T13:00:00Z', home_score: 1, away_score: 0 }

function member(id: string, firstname: string, lastname: string, number: number | null, joined_on = '2026-09-01', left_on: string | null = null): SquadMember {
  return { membership_id: `MS-${id}`, player_id: id, firstname, lastname, icon: null, number, joined_on, left_on, goals: 0, assists: 0 }
}

const bravoSquad = [
  member('P3', 'Zoé', 'Martin', 9),
  member('P1', 'Ali', 'Benali', 4),
  member('P2', 'Bruno', 'Arnaud', null),
  member('P9', 'Gone', 'Before', 7, '2026-09-01', '2026-10-01'),
  member('P8', 'Late', 'Comer', 8, '2026-10-20'),
]
const alphaSquad = [member('A1', 'Hugo', 'Petit', 10), member('A2', 'Enzo', 'Roux', 11)]

function event(partial: Partial<MatchEvent>): MatchEvent {
  return {
    id: 'E1',
    match_id: 'M2',
    team_id: 'T2',
    type: 'goal',
    minute: 10,
    player: null,
    assist_player: null,
    player_in: null,
    own_goal: false,
    penalty: false,
    note: null,
    sent_off: false,
    home_score: null,
    away_score: null,
    ...partial,
  }
}

type Sent = { body?: unknown; calls: number }

function open(match: Match = live, events: MatchEvent[] = [], ...handlers: Parameters<typeof server.use>) {
  mockSeason()
  server.use(
    http.get(M, () => HttpResponse.json(match)),
    http.get(`${M}/events`, () => HttpResponse.json(events)),
    http.get(`${S}/teams/T2/squad`, () => HttpResponse.json(bravoSquad)),
    http.get(`${S}/teams/T1/squad`, () => HttpResponse.json(alphaSquad)),
  )
  server.use(...handlers)
  return renderRoute('/leagues/L1/seasons/S1/matches/M2', { me: adminOne })
}

function recording(sent: Sent, response: () => Response = () => HttpResponse.json(event({}), { status: 201 })) {
  return http.post(`${M}/events`, async ({ request }) => {
    sent.calls += 1
    sent.body = await request.json()
    return response()
  })
}

const EVENT_BUTTONS = ['But', 'Carton jaune', 'Carton rouge', 'Remplacement', 'Blessure']

async function openForm(user: Awaited<ReturnType<typeof open>>['user'], label: string) {
  const section = await screen.findByRole('region', { name: 'Faits de match' })
  await user.click(within(section).getByRole('button', { name: label }))
  return screen.getByRole('dialog')
}

const optionLabels = (select: HTMLElement) => [...select.querySelectorAll('option')].map((option) => option.textContent)

test.each<MatchStatus>(['live', 'finished'])('a %s match offers the five event buttons', async (status) => {
  open({ ...live, status })
  const section = await screen.findByRole('region', { name: 'Faits de match' })
  for (const label of EVENT_BUTTONS) {
    expect(within(section).getByRole('button', { name: label })).toBeInTheDocument()
  }
})

test.each<MatchStatus>(['scheduled', 'postponed', 'cancelled'])('a %s match has no events section', async (status) => {
  open({ ...live, status, home_score: null, away_score: null })
  await screen.findByRole('region', { name: 'Match' })
  expect(screen.queryByRole('region', { name: 'Faits de match' })).not.toBeInTheDocument()
})

test('the events are listed newest first, with what each one means', async () => {
  open(live, [
    event({ id: 'E1', minute: 12, player: { id: 'P1', firstname: 'Ali', lastname: 'Benali' }, assist_player: { id: 'P3', firstname: 'Zoé', lastname: 'Martin' }, home_score: 1, away_score: 0 }),
    event({ id: 'E2', minute: 30, type: 'yellow_card', team_id: 'T1', player: { id: 'A1', firstname: 'Hugo', lastname: 'Petit' } }),
    event({ id: 'E3', minute: 55, type: 'yellow_card', team_id: 'T1', player: { id: 'A1', firstname: 'Hugo', lastname: 'Petit' }, sent_off: true }),
    event({ id: 'E4', minute: 60, type: 'substitution', player: { id: 'P1', firstname: 'Ali', lastname: 'Benali' }, player_in: { id: 'P2', firstname: 'Bruno', lastname: 'Arnaud' } }),
    event({ id: 'E5', minute: 70, type: 'injury', team_id: 'T1', player: { id: 'A2', firstname: 'Enzo', lastname: 'Roux' }, note: 'Cheville' }),
    event({ id: 'E6', minute: 80, own_goal: true, team_id: 'T1', player: { id: 'P3', firstname: 'Zoé', lastname: 'Martin' } }),
    event({ id: 'E7', minute: 85, penalty: true, player: null }),
  ])
  const list = await screen.findByRole('list', { name: 'Faits de match' })
  const items = within(list).getAllByRole('listitem').map((item) => item.textContent ?? '')
  expect(items.map((item) => item.split("'")[0])).toEqual(['85', '80', '70', '60', '55', '30', '12'])
  expect(items[0]).toMatch(/But.*Penalty.*Buteur inconnu.*FC Bravo/)
  expect(items[1]).toMatch(/But contre son camp.*Zoé Martin.*AS Alpha/)
  expect(items[2]).toMatch(/Blessure.*Enzo Roux.*Cheville/)
  expect(items[3]).toMatch(/Remplacement.*Ali Benali.*Bruno Arnaud/)
  expect(items[4]).toMatch(/2e jaune.*Hugo Petit/)
  expect(items[5]).toMatch(/Carton jaune.*Hugo Petit/)
  expect(items[6]).toMatch(/But.*Ali Benali.*Zoé Martin/)
})

test('a goal: the squad of the match day, by number then name, with an unknown scorer first', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(live, [], recording(sent))
  const dialog = await openForm(user, 'But')
  await user.click(within(dialog).getByRole('button', { name: 'FC Bravo' }))
  const scorer = within(dialog).getByLabelText('Buteur')
  expect(optionLabels(scorer)).toEqual(['Buteur inconnu', '4 · Ali Benali', '9 · Zoé Martin', 'Bruno Arnaud'])
  await user.selectOptions(scorer, 'P3')
  await user.selectOptions(within(dialog).getByLabelText('Passeur'), 'P1')
  const minute = within(dialog).getByLabelText('Minute')
  await user.clear(minute)
  await user.type(minute, '37')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() =>
    expect(sent.body).toEqual({ type: 'goal', team_id: 'T2', minute: 37, player_id: 'P3', assist_player_id: 'P1', own_goal: false, penalty: false }),
  )
})

test('the assist list leaves out the scorer', async () => {
  const { user } = open()
  const dialog = await openForm(user, 'But')
  await user.click(within(dialog).getByRole('button', { name: 'FC Bravo' }))
  await user.selectOptions(within(dialog).getByLabelText('Buteur'), 'P3')
  expect(optionLabels(within(dialog).getByLabelText('Passeur'))).toEqual(['Aucun', '4 · Ali Benali', 'Bruno Arnaud'])
})

test('a goal without a known scorer sends no player', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(live, [], recording(sent))
  const dialog = await openForm(user, 'But')
  await user.click(within(dialog).getByRole('button', { name: 'AS Alpha' }))
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toMatchObject({ type: 'goal', team_id: 'T1', player_id: null, assist_player_id: null }))
})

test('an own goal lists the other team, and has no assist', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(live, [], recording(sent))
  const dialog = await openForm(user, 'But')
  await user.click(within(dialog).getByRole('button', { name: 'AS Alpha' }))
  await user.click(within(dialog).getByLabelText('But contre son camp'))
  expect(optionLabels(within(dialog).getByLabelText('Buteur'))).toEqual(['Buteur inconnu', '4 · Ali Benali', '9 · Zoé Martin', 'Bruno Arnaud'])
  expect(within(dialog).queryByLabelText('Passeur')).not.toBeInTheDocument()
  await user.selectOptions(within(dialog).getByLabelText('Buteur'), 'P1')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toMatchObject({ team_id: 'T1', player_id: 'P1', own_goal: true, assist_player_id: null }))
})

test('a penalty has no assist', async () => {
  const { user } = open()
  const dialog = await openForm(user, 'But')
  await user.click(within(dialog).getByRole('button', { name: 'FC Bravo' }))
  await user.click(within(dialog).getByLabelText('Penalty'))
  expect(within(dialog).queryByLabelText('Passeur')).not.toBeInTheDocument()
})

test('the minute is prefilled from the kickoff', async () => {
  const kickoff = new Date(Date.now() - 30 * 60_000 - 10_000).toISOString()
  const { user } = open({ ...live, kickoff_at: kickoff })
  const dialog = await openForm(user, 'Carton jaune')
  expect(within(dialog).getByLabelText('Minute')).toHaveValue(31)
})

test('a match without a kickoff leaves the minute empty', async () => {
  const { user } = open({ ...live, kickoff_at: null })
  const dialog = await openForm(user, 'Carton jaune')
  expect(within(dialog).getByLabelText('Minute')).toHaveValue(null)
})

test('a card names a player of the chosen team', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(live, [], recording(sent))
  const dialog = await openForm(user, 'Carton rouge')
  await user.click(within(dialog).getByRole('button', { name: 'AS Alpha' }))
  const player = within(dialog).getByLabelText('Joueur')
  expect(optionLabels(player)).toEqual(['Choisir…', '10 · Hugo Petit', '11 · Enzo Roux'])
  await user.selectOptions(player, 'A2')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toMatchObject({ type: 'red_card', team_id: 'T1', player_id: 'A2' }))
})

test('a substitution names the player leaving and the player coming in', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(live, [], recording(sent))
  const dialog = await openForm(user, 'Remplacement')
  await user.click(within(dialog).getByRole('button', { name: 'FC Bravo' }))
  await user.selectOptions(within(dialog).getByLabelText('Sort'), 'P1')
  await user.selectOptions(within(dialog).getByLabelText('Entre'), 'P2')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toMatchObject({ type: 'substitution', team_id: 'T2', player_id: 'P1', player_in_id: 'P2' }))
})

test('an injury takes an optional note', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(live, [], recording(sent))
  const dialog = await openForm(user, 'Blessure')
  await user.click(within(dialog).getByRole('button', { name: 'FC Bravo' }))
  await user.selectOptions(within(dialog).getByLabelText('Joueur'), 'P1')
  const note = within(dialog).getByLabelText('Note')
  expect(note).toHaveAttribute('maxlength', '200')
  await user.type(note, 'Cheville')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toMatchObject({ type: 'injury', player_id: 'P1', note: 'Cheville' }))
})

test('the event can only be saved once a team is chosen', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(live, [], recording(sent))
  const dialog = await openForm(user, 'But')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  expect(await within(dialog).findByText("Choisissez l'équipe.")).toBeInTheDocument()
  expect(sent.calls).toBe(0)
})

test('after a goal, the header shows the new score', async () => {
  const sent: Sent = { calls: 0 }
  let current = live
  const { user } = open(
    live,
    [],
    http.get(M, () => HttpResponse.json(current)),
    http.post(`${M}/events`, async ({ request }) => {
      sent.calls += 1
      sent.body = await request.json()
      current = { ...live, home_score: 2 }
      return HttpResponse.json(event({ home_score: 2, away_score: 0 }), { status: 201 })
    }),
  )
  const dialog = await openForm(user, 'But')
  await user.click(within(dialog).getByRole('button', { name: 'FC Bravo' }))
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.calls).toBe(1))
  expect(await within(screen.getByRole('region', { name: 'Match' })).findByText('2 – 0')).toBeInTheDocument()
})

test('a 422 is shown under its field', async () => {
  const { user } = open(
    live,
    [],
    http.post(`${M}/events`, () => HttpResponse.json({ errors: { player_id: "n'est pas dans l'effectif de l'équipe ce jour-là" } }, { status: 422 })),
  )
  const dialog = await openForm(user, 'Carton jaune')
  await user.click(within(dialog).getByRole('button', { name: 'FC Bravo' }))
  await user.selectOptions(within(dialog).getByLabelText('Joueur'), 'P1')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  expect(await within(dialog).findByText("n'est pas dans l'effectif de l'équipe ce jour-là")).toBeInTheDocument()
  expect(within(dialog).getByLabelText('Joueur')).toHaveAccessibleDescription("n'est pas dans l'effectif de l'équipe ce jour-là")
})

test('a 409 is shown in the form', async () => {
  const { user } = open(live, [], http.post(`${M}/events`, () => HttpResponse.json({ error: 'player is already sent off' }, { status: 409 })))
  const dialog = await openForm(user, 'Carton jaune')
  await user.click(within(dialog).getByRole('button', { name: 'FC Bravo' }))
  await user.selectOptions(within(dialog).getByLabelText('Joueur'), 'P1')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  expect(await within(dialog).findByText('Ce joueur est déjà exclu.')).toBeInTheDocument()
})

test('deleting an event asks for confirmation', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(
    live,
    [event({ id: 'E1', minute: 12 })],
    http.delete(`${M}/events/E1`, () => {
      sent.calls += 1
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const list = await screen.findByRole('list', { name: 'Faits de match' })
  await user.click(within(list).getByRole('button', { name: 'Supprimer' }))
  expect(sent.calls).toBe(0)
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
  await vi.waitFor(() => expect(sent.calls).toBe(1))
})

test('a match without events says so', async () => {
  open()
  const section = await screen.findByRole('region', { name: 'Faits de match' })
  expect(await within(section).findByText('Aucun fait de match.')).toBeInTheDocument()
})
