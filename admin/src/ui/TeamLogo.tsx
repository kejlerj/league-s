import { useEffect, useState } from 'react'

type Team = { name: string; logo: string | null }

export function initialOf(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('fr')
}

export function TeamLogo({ team }: { team: Team }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [team.logo])

  if (team.logo !== null && !failed) {
    return <img src={team.logo} alt="" className="h-6 w-6 shrink-0 rounded object-contain" onError={() => setFailed(true)} />
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600"
    >
      {initialOf(team.name)}
    </span>
  )
}

export function TeamName({ team }: { team: Team }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <TeamLogo team={team} />
      <span className="truncate">{team.name}</span>
    </span>
  )
}
