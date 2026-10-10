import type { RouteObject } from 'react-router'
import { RequireAuth, RequireLeague } from '@/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <p>Admin</p> },
      {
        path: '/leagues/:leagueId',
        element: <RequireLeague />,
        children: [{ index: true, element: <p>Ligue</p> }],
      },
    ],
  },
]
