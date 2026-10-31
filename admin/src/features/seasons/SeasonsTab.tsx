import { Link } from 'react-router'
import { deleteSeason, listSeasons } from '@/api/seasons'
import type { Season } from '@/api/types'
import { formatDate } from '@/lib/dates'
import { ResourceTab } from '@/ui/ResourceTab'
import { SeasonForm } from './SeasonForm'

export function SeasonsTab({ leagueId }: { leagueId: string }) {
  return (
    <ResourceTab<Season>
      queryKey={['league', leagueId, 'seasons']}
      queryFn={() => listSeasons(leagueId)}
      columns={[
        {
          header: 'Saison',
          cell: (season) => (
            <Link
              to={`/leagues/${leagueId}/seasons/${season.id}`}
              className="font-medium text-emerald-800 underline-offset-2 hover:underline"
            >
              {season.name}
            </Link>
          ),
        },
        { header: 'Début', cell: (season) => formatDate(season.start_on) },
        { header: 'Fin', cell: (season) => formatDate(season.end_on) },
        {
          header: 'Points V / N / D',
          cell: (season) => `${season.match_win_pts} / ${season.match_draw_pts} / ${season.match_loss_pts}`,
        },
      ]}
      rowKey={(season) => season.id}
      describe={(season) => season.name}
      empty="Aucune saison."
      newLabel="Nouvelle saison"
      editTitle="Modifier la saison"
      removeTitle="Supprimer la saison"
      conflict="Cette saison a des matchs."
      remove={(season) => deleteSeason(leagueId, season.id)}
      form={(props) => <SeasonForm leagueId={leagueId} {...props} />}
    />
  )
}
