import type { RouteObject } from 'react-router'
import { RequireAuth, RequireLeague } from '@/auth/guards'
import { AccountPage } from '@/features/auth/AccountPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <p>Admin</p> },
      { path: '/account', element: <AccountPage /> },
      {
        path: '/leagues/:leagueId',
        element: <RequireLeague />,
        children: [{ index: true, element: <p>Ligue</p> }],
      },
    ],
  },
]
