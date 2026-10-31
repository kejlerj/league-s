import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { logout } from '@/api/auth'
import { useSession } from '@/auth/SessionProvider'
import { Button } from './Button'

export function Layout({ children }: { children: ReactNode }) {
  const { me, clear } = useSession()
  const queryClient = useQueryClient()

  const signOut = async () => {
    await logout().catch(() => {})
    clear()
    queryClient.clear()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/" className="text-sm font-semibold text-emerald-800">
            Ligues
          </Link>
          <span className="ml-auto text-sm text-slate-600">{me?.name}</span>
          <Link to="/account" className="text-sm text-slate-700 underline-offset-2 hover:underline">
            Mon compte
          </Link>
          <Button onClick={() => void signOut()}>Déconnexion</Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
