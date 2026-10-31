import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { getLeague } from '@/api/leagues'
import { useSession } from '@/auth/SessionProvider'
import { LeagueMatchesTab } from '@/features/matches/LeagueMatchesTab'
import { AdminsTab } from '@/features/admins/AdminsTab'
import { PlayersTab } from '@/features/players/PlayersTab'
import { SeasonsTab } from '@/features/seasons/SeasonsTab'
import { TeamsTab } from '@/features/teams/TeamsTab'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { PageState } from '@/ui/PageState'
import { Tabs } from '@/ui/Tabs'
import { LeagueForm } from './LeagueForm'

export function LeaguePage() {
  const { leagueId = '' } = useParams()
  const { refresh } = useSession()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const query = useQuery({ queryKey: ['league', leagueId], queryFn: () => getLeague(leagueId) })

  return (
    <PageState query={query}>
      {(league) => (
        <div>
          <div className="mb-4 flex items-center gap-3">
            {league.logo ? <img src={league.logo} alt="" className="h-8 w-8 rounded object-contain" /> : null}
            <h1 className="text-xl font-semibold text-slate-900">{league.name}</h1>
            <Button className="ml-auto" onClick={() => setEditing(true)}>
              Modifier
            </Button>
          </div>
          <Tabs
            tabs={[
              { id: 'matches', label: 'Matchs', content: <LeagueMatchesTab leagueId={leagueId} /> },
              { id: 'teams', label: 'Équipes', content: <TeamsTab leagueId={leagueId} /> },
              { id: 'players', label: 'Joueurs', content: <PlayersTab leagueId={leagueId} /> },
              { id: 'seasons', label: 'Saisons', content: <SeasonsTab leagueId={leagueId} /> },
              { id: 'admins', label: 'Admins', content: <AdminsTab leagueId={leagueId} leagueName={league.name} /> },
            ]}
          />
          <Modal title="Modifier la ligue" open={editing} onClose={() => setEditing(false)}>
            <LeagueForm
              initial={league}
              onCancel={() => setEditing(false)}
              onDone={() => {
                setEditing(false)
                void queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
                void queryClient.invalidateQueries({ queryKey: ['leagues'] })
                void refresh()
              }}
            />
          </Modal>
        </div>
      )}
    </PageState>
  )
}
