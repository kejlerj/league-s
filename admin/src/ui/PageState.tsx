import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError } from '@/api/client'
import { Button } from './Button'
import { errorMessage } from './errorMessage'

type Props<T> = {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
}

export function PageState<T>({ query, children }: Props<T>) {
  if (query.isPending) {
    return <p className="text-sm text-slate-500">Chargement…</p>
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return <p className="text-sm text-slate-700">Introuvable.</p>
    }
    return (
      <div role="alert" className="flex items-center gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
        <span>{errorMessage(query.error)}</span>
        <Button onClick={() => void query.refetch()}>Réessayer</Button>
      </div>
    )
  }
  return <>{children(query.data)}</>
}
