import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { adminOne, leagueL1, mockLeague, superadmin } from '@/test/fixtures'
import type { Me } from '@/api/types'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

const admins = [{ id: 'U1', email: 'nord@ligue.test', name: 'Admin Nord' }]
const pending = [{ id: 'I1', email: 'invite@ligue.test', expires_at: '2026-10-17T10:00:00Z' }]
const LINK = 'http://localhost:5173/admin/invitation?token=tok123'

function setup(me: Me, calls: string[] = []) {
  mockLeague(leagueL1)
  server.use(
    http.get(`${API}/leagues/L1/admins`, () => HttpResponse.json(admins)),
    http.get(`${API}/leagues/L1/invitations`, () => {
      calls.push('invitations')
      return HttpResponse.json(pending)
    }),
  )
  return renderRoute('/leagues/L1?tab=admins', { me })
}

test('a plain admin sees the list, without invite or remove', async () => {
  const calls: string[] = []
  setup(adminOne, calls)
  expect(await screen.findByText('nord@ligue.test')).toBeInTheDocument()
  expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument()
  expect(calls).toEqual([])
})

test('the superadmin invites and gets the link, a mailto and a copy button', async () => {
  let body: unknown
  server.use(
    http.post(`${API}/leagues/L1/invitations`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(
        { id: 'I2', email: 'nouveau@ligue.test', expires_at: '2026-10-17T10:00:00Z', link: LINK },
        { status: 201 },
      )
    }),
  )
  const { user } = setup(superadmin)
  await user.type(await screen.findByLabelText('E-mail'), 'nouveau@ligue.test')
  await user.click(screen.getByRole('button', { name: 'Inviter' }))
  expect(await screen.findByText('Invitation créée pour nouveau@ligue.test.')).toBeInTheDocument()
  expect(body).toEqual({ email: 'nouveau@ligue.test' })
  expect(screen.getByLabelText("Lien d'invitation")).toHaveValue(LINK)
  expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeInTheDocument()
  const mailto = screen.getByRole('link', { name: 'Envoyer par e-mail' }).getAttribute('href')!
  expect(mailto.startsWith('mailto:nouveau%40ligue.test?')).toBe(true)
  expect(decodeURIComponent(mailto)).toContain(LINK)
  expect(decodeURIComponent(mailto)).toContain('District Nord')
})

test('inviting someone who is already an admin', async () => {
  server.use(http.post(`${API}/leagues/L1/invitations`, () => HttpResponse.json({ error: 'x' }, { status: 409 })))
  const { user } = setup(superadmin)
  await user.type(await screen.findByLabelText('E-mail'), 'nord@ligue.test')
  await user.click(screen.getByRole('button', { name: 'Inviter' }))
  expect(await screen.findByText('Cette personne est déjà admin de la ligue.')).toBeInTheDocument()
})

test('the superadmin cancels a pending invitation', async () => {
  let deleted = false
  server.use(
    http.delete(`${API}/leagues/L1/invitations/I1`, () => {
      deleted = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { user } = setup(superadmin)
  const row = (await screen.findByText('invite@ligue.test')).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Annuler' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: "Annuler l'invitation" }))
  await vi.waitFor(() => expect(deleted).toBe(true))
})

test('the superadmin removes an admin', async () => {
  let deleted = false
  server.use(
    http.delete(`${API}/leagues/L1/admins/U1`, () => {
      deleted = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { user } = setup(superadmin)
  const row = (await screen.findByText('nord@ligue.test')).closest('tr')!
  await user.click(within(row).getByRole('button', { name: 'Retirer' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retirer' }))
  await vi.waitFor(() => expect(deleted).toBe(true))
})
