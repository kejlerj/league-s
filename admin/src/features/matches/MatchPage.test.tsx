import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { Match, MatchStatus } from '@/api/types'
import { utcToLocal } from '@/lib/dates'
import { adminOne, matchLive, matchScheduled, mockSeason } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

const M = `${API}/leagues/L1/seasons/S1/matches`

type Sent = { body?: unknown; calls: number }

function capture(target: Sent, response: () => Response = () => HttpResponse.json(matchScheduled)) {
  return async ({ request }: { request: Request }) => {
    target.calls += 1
    target.body = await request.json().catch(() => undefined)
    return response()
  }
}

const matchFinished: Match = { ...matchLive, status: 'finished', home_score: 2, away_score: 1 }

function open(match: Match, ...handlers: Parameters<typeof server.use>) {
  mockSeason()
  server.use(http.get(`${M}/${match.id}`, () => HttpResponse.json(match)), ...handlers)
  return renderRoute(`/leagues/L1/seasons/S1/matches/${match.id}`, { me: adminOne })
}

const STATUS_BUTTONS = ['Démarrer', 'Terminer', 'Reporter', 'Annuler', 'Supprimer']

test('the header shows the teams, matchday, date, venue, status and score', async () => {
  open({ ...matchFinished, kickoff_at: '2026-10-11T13:00:00Z' })
  const header = await screen.findByRole('region', { name: 'Match' })
  expect(within(header).getByText('FC Bravo')).toBeInTheDocument()
  expect(within(header).getByText('AS Alpha')).toBeInTheDocument()
  expect(within(header).getByText(/Journée 1/)).toBeInTheDocument()
  expect(within(header).getByText(/11\/10\/2026 \d{2}:\d{2}/)).toBeInTheDocument()
  expect(within(header).getByText(/Stade Nord/)).toBeInTheDocument()
  expect(within(header).getByText('Terminé')).toBeInTheDocument()
  expect(within(header).getByText('2 – 1')).toBeInTheDocument()
})

test('a live match with a kickoff shows the elapsed minute', async () => {
  const kickoff = new Date(Date.now() - 30 * 60_000 - 10_000).toISOString()
  open({ ...matchLive, kickoff_at: kickoff })
  const header = await screen.findByRole('region', { name: 'Match' })
  expect(within(header).getByText("31'")).toBeInTheDocument()
})

test.each<[MatchStatus, string[]]>([
  ['scheduled', ['Démarrer', 'Reporter', 'Annuler', 'Supprimer']],
  ['live', ['Terminer', 'Reporter', 'Annuler']],
  ['postponed', ['Annuler']],
  ['finished', []],
  ['cancelled', []],
])('a %s match shows the status buttons %j', async (status, expected) => {
  open({ ...matchScheduled, status })
  await screen.findByRole('region', { name: 'Match' })
  const actions = screen.queryByRole('group', { name: 'Statut du match' })
  const shown = actions === null ? [] : STATUS_BUTTONS.filter((label) => within(actions).queryByRole('button', { name: label }) !== null)
  expect(shown).toEqual(expected)
})

test('Démarrer starts the match and the page shows it live', async () => {
  const sent: Sent = { calls: 0 }
  let current: Match = matchScheduled
  mockSeason()
  server.use(
    http.get(`${M}/M1`, () => HttpResponse.json(current)),
    http.post(`${M}/M1/start`, async (info) => {
      current = { ...matchScheduled, status: 'live', home_score: 0, away_score: 0 }
      return capture(sent, () => HttpResponse.json(current))(info)
    }),
  )
  const { user } = renderRoute('/leagues/L1/seasons/S1/matches/M1', { me: adminOne })
  await user.click(await screen.findByRole('button', { name: 'Démarrer' }))
  await vi.waitFor(() => expect(sent.calls).toBe(1))
  const header = screen.getByRole('region', { name: 'Match' })
  expect(await within(header).findByText('En cours')).toBeInTheDocument()
  expect(within(header).getByText('0 – 0')).toBeInTheDocument()
})

test('an API error on a status change is shown', async () => {
  const { user } = open(matchScheduled, http.post(`${M}/M1/start`, () => HttpResponse.json({ error: 'match is not scheduled' }, { status: 409 })))
  await user.click(await screen.findByRole('button', { name: 'Démarrer' }))
  expect(await screen.findByText('match is not scheduled')).toBeInTheDocument()
})

test('Terminer asks for confirmation, then finishes the match', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(matchLive, http.post(`${M}/M2/finish`, capture(sent)))
  await user.click(await screen.findByRole('button', { name: 'Terminer' }))
  expect(sent.calls).toBe(0)
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Terminer' }))
  await vi.waitFor(() => expect(sent.calls).toBe(1))
})

test('Annuler on a live match says its score will not count, then cancels it', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(matchLive, http.post(`${M}/M2/cancel`, capture(sent)))
  await user.click(await screen.findByRole('button', { name: 'Annuler' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText(/ne compte pas au classement/)).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Annuler le match' }))
  await vi.waitFor(() => expect(sent.calls).toBe(1))
})

test('Supprimer asks for confirmation, then goes back to the matches list', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(matchScheduled, http.delete(`${M}/M1`, () => {
    sent.calls += 1
    return new HttpResponse(null, { status: 204 })
  }))
  await user.click(await screen.findByRole('button', { name: 'Supprimer' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
  await vi.waitFor(() => expect(sent.calls).toBe(1))
  expect(await screen.findByRole('button', { name: 'Programmer un match' })).toBeInTheDocument()
})

test('Reporter without a new date sends an empty body', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(matchScheduled, http.post(`${M}/M1/postpone`, capture(sent)))
  await user.click(await screen.findByRole('button', { name: 'Reporter' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reporter' }))
  await vi.waitFor(() => expect(sent.body).toEqual({}))
})

test('Modifier on a scheduled match changes the matchday and the venue', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(matchScheduled, http.patch(`${M}/M1`, capture(sent)))
  await user.click(await screen.findByRole('button', { name: 'Modifier' }))
  const dialog = screen.getByRole('dialog')
  const matchday = within(dialog).getByLabelText('Journée')
  expect(matchday).toHaveValue(1)
  expect(within(dialog).getByLabelText("Coup d'envoi")).toHaveValue(utcToLocal('2026-10-11T13:00:00Z'))
  await user.clear(matchday)
  await user.type(matchday, '4')
  await user.type(within(dialog).getByLabelText('Lieu'), 'Stade Sud')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toEqual({ matchday: 4, kickoff_at: '2026-10-11T13:00:00.000Z', venue: 'Stade Sud' }))
})

test('Modifier on a live match hides the matchday and the kickoff', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(matchLive, http.patch(`${M}/M2`, capture(sent)))
  await user.click(await screen.findByRole('button', { name: 'Modifier' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).queryByLabelText('Journée')).not.toBeInTheDocument()
  expect(within(dialog).queryByLabelText("Coup d'envoi")).not.toBeInTheDocument()
  expect(within(dialog).getByLabelText('Lieu')).toHaveValue('Stade Nord')
  await user.type(within(dialog).getByLabelText('Arbitre'), 'M. Petit')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toEqual({ venue: 'Stade Nord', referee: 'M. Petit' }))
})

test.each<MatchStatus>(['scheduled', 'postponed', 'cancelled'])('a %s match has no score form', async (status) => {
  open({ ...matchScheduled, status })
  await screen.findByRole('region', { name: 'Match' })
  expect(screen.queryByRole('button', { name: 'Corriger le score' })).not.toBeInTheDocument()
})

test('correcting a live match score', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(matchLive, http.put(`${M}/M2/score`, capture(sent)))
  await user.click(await screen.findByRole('button', { name: 'Corriger le score' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).queryByText(/classement sera mis à jour/)).not.toBeInTheDocument()
  const home = within(dialog).getByLabelText('FC Bravo')
  await user.clear(home)
  await user.type(home, '2')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toEqual({ home: 2, away: 0 }))
})

test('correcting a finished match score says the standings will be updated', async () => {
  const sent: Sent = { calls: 0 }
  const { user } = open(matchFinished, http.put(`${M}/M2/score`, capture(sent)))
  await user.click(await screen.findByRole('button', { name: 'Corriger le score' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText(/classement sera mis à jour/)).toBeInTheDocument()
  expect(within(dialog).getByLabelText('FC Bravo')).toHaveValue(2)
  const away = within(dialog).getByLabelText('AS Alpha')
  await user.clear(away)
  await user.type(away, '3')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => expect(sent.body).toEqual({ home: 2, away: 3 }))
})

test('a score below the recorded goals shows why it is refused', async () => {
  const { user } = open(matchFinished, http.put(`${M}/M2/score`, () => HttpResponse.json({ error: 'score below goals' }, { status: 409 })))
  await user.click(await screen.findByRole('button', { name: 'Corriger le score' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('Le score ne peut pas être inférieur au nombre de buts saisis.')).toBeInTheDocument()
})

test('a match of another season is not found', async () => {
  mockSeason()
  server.use(http.get(`${M}/M9`, () => HttpResponse.json({ error: 'match not found' }, { status: 404 })))
  renderRoute('/leagues/L1/seasons/S1/matches/M9', { me: adminOne })
  expect(await screen.findByText(/introuvable/i)).toBeInTheDocument()
})

test('the page links back to the season matches', async () => {
  open(matchLive)
  const back = await screen.findByRole('link', { name: 'Retour aux matchs' })
  expect(back).toHaveAttribute('href', '/leagues/L1/seasons/S1?tab=matches')
})
