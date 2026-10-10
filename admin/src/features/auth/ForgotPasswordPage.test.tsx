import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { renderRoute } from '@/test/render'
import { API, server } from '@/test/server'

test('la demande affiche toujours le même message', async () => {
  let body: unknown
  server.use(
    http.post(`${API}/auth/password-reset`, async ({ request }) => {
      body = await request.json()
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { user } = renderRoute('/forgot-password', { me: null })
  await user.type(await screen.findByLabelText('E-mail'), 'nord@ligue.test')
  await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }))
  expect(
    await screen.findByText("Si un compte existe pour cette adresse, un e-mail vient d'être envoyé."),
  ).toBeInTheDocument()
  expect(body).toEqual({ email: 'nord@ligue.test' })
})
