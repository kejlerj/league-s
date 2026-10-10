import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Me } from '@/api/types'
import { SessionProvider } from '@/auth/SessionProvider'
import { routes } from '@/routes'
import { mockMe, superadmin } from './fixtures'

type Options = { me?: Me | null }

export function renderRoute(path: string, { me = superadmin }: Options = {}): { user: UserEvent } {
  mockMe(me)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>,
  )
  return { user: userEvent.setup() }
}
