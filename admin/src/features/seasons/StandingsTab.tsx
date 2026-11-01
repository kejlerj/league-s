import { useQuery } from '@tanstack/react-query'
import { getStandings } from '@/api/standings'
import type { StandingRow } from '@/api/types'
import { DataTable, type Column } from '@/ui/DataTable'
import { PageState } from '@/ui/PageState'
import { TeamName } from '@/ui/TeamLogo'

const signed = (value: number) => (value > 0 ? `+${value}` : String(value))

const number = (header: string, value: (row: StandingRow) => number | string): Column<StandingRow> => ({
  header,
  align: 'right',
  cell: value,
})

const COLUMNS: Column<StandingRow>[] = [
  { header: '#', cell: (row) => row.rank },
  { header: 'Équipe', cell: (row) => <TeamName team={{ name: row.team_name, logo: row.team_logo }} /> },
  number('J', (row) => row.played),
  number('G', (row) => row.won),
  number('N', (row) => row.drawn),
  number('P', (row) => row.lost),
  number('BP', (row) => row.goals_for),
  number('BC', (row) => row.goals_against),
  number('Diff', (row) => signed(row.goal_difference)),
  number('Pts', (row) => row.points),
]

export function StandingsTab({ leagueId, seasonId }: { leagueId: string; seasonId: string }) {
  const query = useQuery({
    queryKey: ['season', seasonId, 'standings'],
    queryFn: () => getStandings(leagueId, seasonId),
  })

  return (
    <PageState query={query}>
      {(rows) => <DataTable rows={rows} columns={COLUMNS} rowKey={(row) => row.team_id} empty="Aucun match terminé." />}
    </PageState>
  )
}
