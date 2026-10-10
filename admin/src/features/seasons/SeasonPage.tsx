import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { getSeason } from '@/api/seasons'
import { formatDate } from '@/lib/dates'
import { PageState } from '@/ui/PageState'
import { Tabs } from '@/ui/Tabs'
import { SeasonTeamsTab } from './SeasonTeamsTab'
import { StandingsTab } from './StandingsTab'

export function SeasonPage() {
  const { leagueId = '', seasonId = '' } = useParams()
  const query = useQuery({ queryKey: ['season', seasonId], queryFn: () => getSeason(leagueId, seasonId) })

  return (
    <PageState query={query}>
      {(season) => (
        <div>
          <Link to={`/leagues/${leagueId}?tab=seasons`} className="text-sm text-emerald-800 underline-offset-2 hover:underline">
            Retour à la ligue
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">{season.name}</h1>
          <p className="mb-4 text-sm text-slate-600">
            Du {formatDate(season.start_on)} au {formatDate(season.end_on)}
          </p>
          <Tabs
            tabs={[
              { id: 'teams', label: 'Équipes', content: <SeasonTeamsTab leagueId={leagueId} seasonId={seasonId} /> },
              { id: 'matches', label: 'Matchs', content: null },
              { id: 'standings', label: 'Classement', content: <StandingsTab leagueId={leagueId} seasonId={seasonId} /> },
            ]}
          />
        </div>
      )}
    </PageState>
  )
}
