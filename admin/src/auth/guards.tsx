import { Navigate, Outlet, useLocation, useParams } from 'react-router'
import { Button } from '@/ui/Button'
import { Layout } from '@/ui/Layout'
import { useSession } from './SessionProvider'

export function RequireAuth() {
  const { me, loading, failed, refresh } = useSession()
  const location = useLocation()

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">Chargement…</p>
  }
  if (failed) {
    return (
      <div role="alert" className="m-6 flex items-center gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
        <span>Une erreur est survenue. Réessayez.</span>
        <Button onClick={() => void refresh()}>Réessayer</Button>
      </div>
    )
  }
  if (me === null) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

export function RequireLeague() {
  const { leagueId = '' } = useParams()
  const { canWrite } = useSession()

  if (!canWrite(leagueId)) {
    return <p className="text-sm text-slate-700">Accès refusé.</p>
  }
  return <Outlet />
}
