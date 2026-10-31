import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getMe } from '@/api/auth'
import { ApiError, onUnauthorized } from '@/api/client'
import type { Me } from '@/api/types'

type Session = {
  me: Me | null
  loading: boolean
  failed: boolean
  isSuperadmin: boolean
  canWrite: (leagueId: string) => boolean
  refresh: () => Promise<void>
  clear: () => void
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setMe(await getMe())
      setFailed(false)
    } catch (err) {
      setMe(null)
      setFailed(!(err instanceof ApiError && err.status === 401))
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => setMe(null), [])

  useEffect(() => {
    onUnauthorized(clear)
    void refresh()
    return () => onUnauthorized(() => {})
  }, [clear, refresh])

  const value = useMemo<Session>(
    () => ({
      me,
      loading,
      failed,
      isSuperadmin: me?.is_superadmin ?? false,
      canWrite: (leagueId) => me !== null && (me.is_superadmin || me.leagues.some((league) => league.id === leagueId)),
      refresh,
      clear,
    }),
    [me, loading, failed, refresh, clear],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (session === null) {
    throw new Error('useSession must be used inside SessionProvider')
  }
  return session
}
