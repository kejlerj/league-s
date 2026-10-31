import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { listSeasons } from '@/api/seasons'
import type { Season } from '@/api/types'
import { SelectField } from '@/ui/Field'
import { PageState } from '@/ui/PageState'
import { MatchesTab } from './MatchesTab'

export function currentSeason(seasons: Season[], now: Date): Season | undefined {
  const time = now.getTime()
  const byStart = [...seasons].sort((a, b) => a.start_on.localeCompare(b.start_on))
  const running = byStart.find((season) => Date.parse(season.start_on) <= time && time <= Date.parse(season.end_on))
  const next = byStart.find((season) => Date.parse(season.start_on) > time)
  return running ?? next ?? byStart[byStart.length - 1]
}

export function LeagueMatchesTab({ leagueId }: { leagueId: string }) {
  const [chosen, setChosen] = useState<string | null>(null)
  const seasons = useQuery({ queryKey: ['league', leagueId, 'seasons'], queryFn: () => listSeasons(leagueId) })

  return (
    <PageState query={seasons}>
      {(rows) => {
        const season = rows.find((item) => item.id === chosen) ?? currentSeason(rows, new Date())
        if (season === undefined) {
          return (
            <p className="text-sm text-slate-700">
              Aucune saison. Créez-en une dans l'onglet{' '}
              <Link to={`/leagues/${leagueId}?tab=seasons`} className="text-emerald-800 underline-offset-2 hover:underline">
                Saisons
              </Link>{' '}
              pour programmer des matchs.
            </p>
          )
        }
        return (
          <div>
            <div className="mb-4 flex items-end gap-4">
              <SelectField label="Saison" className="w-56" value={season.id} onChange={(e) => setChosen(e.target.value)}>
                {rows.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
              <Link
                to={`/leagues/${leagueId}/seasons/${season.id}`}
                className="pb-2 text-sm text-emerald-800 underline-offset-2 hover:underline"
              >
                Équipes et classement de la saison
              </Link>
            </div>
            <MatchesTab key={season.id} leagueId={leagueId} seasonId={season.id} />
          </div>
        )
      }}
    </PageState>
  )
}
