import { act, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { api } from '@/api/client'
import { adminOne, leagueL1, mockLeague, mockMe, superadmin } from '@/test/fixtures'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

test('sans session, une page protégée redirige vers la connexion', async () => {
  renderRoute('/leagues/L1', { me: null })
  expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
})

test("un admin d'une autre ligue voit Accès refusé sur un lien profond", async () => {
  renderRoute('/leagues/L2', { me: adminOne })
  expect(await screen.findByText('Accès refusé.')).toBeInTheDocument()
})

test('un admin accède à sa ligue par un lien profond', async () => {
  mockLeague(leagueL1)
  renderRoute('/leagues/L1', { me: adminOne })
  expect(await screen.findByRole('heading', { name: 'District Nord' })).toBeInTheDocument()
})

test("un superadmin accède à n'importe quelle ligue", async () => {
  mockLeague({ id: 'L9', name: 'Neuvième', logo: null })
  renderRoute('/leagues/L9', { me: superadmin })
  expect(await screen.findByRole('heading', { name: 'Neuvième' })).toBeInTheDocument()
})

test('le gabarit affiche le nom et la déconnexion renvoie au login', async () => {
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

test('un 401 sur une écriture renvoie au login puis ramène à la page', async () => {
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
