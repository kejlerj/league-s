import type { RouteObject } from 'react-router'
import { RequireAuth, RequireLeague } from '@/auth/guards'
import { AcceptInvitationPage } from '@/features/admins/AcceptInvitationPage'
import { AccountPage } from '@/features/auth/AccountPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { LeaguePage } from '@/features/leagues/LeaguePage'
import { LeaguesPage } from '@/features/leagues/LeaguesPage'

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/invitation', element: <AcceptInvitationPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <LeaguesPage /> },
      { path: '/account', element: <AccountPage /> },
      {
        path: '/leagues/:leagueId',
        element: <RequireLeague />,
        children: [{ index: true, element: <LeaguePage /> }],
      },
    ],
  },
]
