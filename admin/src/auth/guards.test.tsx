import { act, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { api } from '@/api/client'
import { adminOne, adminTwo, leagueL1, mockLeague, mockMe, superadmin } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

test('a protected page redirects to login without a session', async () => {
  renderRoute('/leagues/L1', { me: null })
  expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
})

test('an admin who opens a league that is not theirs lands in their league', async () => {
  mockLeague(leagueL1)
  renderRoute('/leagues/L2', { me: adminOne })
  expect(await screen.findByRole('heading', { name: 'District Nord' })).toBeInTheDocument()
  expect(screen.queryByText('Accès refusé.')).not.toBeInTheDocument()
})

test('an admin of several leagues who opens another league lands on the list of their leagues', async () => {
  renderRoute('/leagues/L9', { me: adminTwo })
  expect(await screen.findByRole('heading', { name: 'Ligues' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'District Sud' })).toBeInTheDocument()
})

test('after a superadmin logs out, an admin who logs in lands in their league', async () => {
  mockLeague({ id: 'L9', name: 'Neuvième', logo: null })
  const { user } = renderRoute('/leagues/L9', { me: superadmin })
  expect(await screen.findByRole('heading', { name: 'Neuvième' })).toBeInTheDocument()

  server.use(http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })))
  mockMe(null)
  await user.click(screen.getByRole('button', { name: 'Déconnexion' }))
  expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()

  mockLeague(leagueL1)
  server.use(
    http.post(`${API}/auth/login`, () => {
      mockMe(adminOne)
      return HttpResponse.json(adminOne)
    }),
  )
  await user.type(screen.getByLabelText('E-mail'), 'nord@ligue.test')
  await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse-long')
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
  expect(await screen.findByRole('heading', { name: 'District Nord' })).toBeInTheDocument()
})

test('an admin reaches their league through a deep link', async () => {
  mockLeague(leagueL1)
  renderRoute('/leagues/L1', { me: adminOne })
  expect(await screen.findByRole('heading', { name: 'District Nord' })).toBeInTheDocument()
})

test('a superadmin reaches any league', async () => {
  mockLeague({ id: 'L9', name: 'Neuvième', logo: null })
  renderRoute('/leagues/L9', { me: superadmin })
  expect(await screen.findByRole('heading', { name: 'Neuvième' })).toBeInTheDocument()
})

test('the layout shows the name, and logging out goes back to login', async () => {
  mockLeague(leagueL1)
  const { user } = renderRoute('/leagues/L1', { me: adminOne })
  expect(await screen.findByText('Admin Nord')).toBeInTheDocument()
  let called = false
  server.use(
    http.post(`${API}/auth/logout`, () => {
      called = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Déconnexion' }))
  expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
  expect(called).toBe(true)
})

test('a 401 on a write goes to login, then back to the page', async () => {
  mockLeague(leagueL1)
  const { user } = renderRoute('/leagues/L1', { me: adminOne })
  expect(await screen.findByRole('heading', { name: 'District Nord' })).toBeInTheDocument()

  server.use(
    http.post(`${API}/leagues/L1/teams`, () => HttpResponse.json({ error: 'authentication required' }, { status: 401 })),
  )
  await act(async () => {
    await api('POST', '/leagues/L1/teams', { body: {} }).catch(() => {})
  })
  expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()

  server.use(http.post(`${API}/auth/login`, () => HttpResponse.json(adminOne)))
  mockMe(adminOne)
  await user.type(screen.getByLabelText('E-mail'), 'nord@ligue.test')
  await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse-long')
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
  expect(await screen.findByRole('heading', { name: 'District Nord' })).toBeInTheDocument()
})
