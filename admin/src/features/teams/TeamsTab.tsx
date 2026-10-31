import { deleteTeam, listTeams } from '@/api/teams'
import type { Team } from '@/api/types'
import { ResourceTab } from '@/ui/ResourceTab'
import { TeamForm } from './TeamForm'

export function TeamsTab({ leagueId }: { leagueId: string }) {
  return (
    <ResourceTab<Team>
      queryKey={['league', leagueId, 'teams']}
      queryFn={() => listTeams(leagueId)}
      columns={[
        {
          header: 'Équipe',
          cell: (team) => (
            <span className="flex items-center gap-2">
              {team.logo ? <img src={team.logo} alt="" className="h-6 w-6 rounded object-contain" /> : null}
              {team.name}
            </span>
          ),
        },
      ]}
      rowKey={(team) => team.id}
      describe={(team) => team.name}
      empty="Aucune équipe."
      newLabel="Nouvelle équipe"
      editTitle="Modifier l'équipe"
      removeTitle="Supprimer l'équipe"
      conflict="Cette équipe a un historique."
      remove={(team) => deleteTeam(leagueId, team.id)}
      form={(props) => <TeamForm leagueId={leagueId} {...props} />}
    />
  )
}
