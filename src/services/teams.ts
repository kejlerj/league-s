import { withLatency } from './_shared';
import { teams } from '../data/teams';
import { players } from '../data/players';
import { fixtures } from '../data/fixtures';
import type { TeamDetail, ResultLine, Match } from '../types';

export function getTeam(id: string): Promise<TeamDetail> {
  return withLatency(() => {
    const team = teams.find((t) => t.id === id);
    if (!team) {
      throw new Error(`Équipe introuvable : ${id}`);
    }

    const teamFixtures = fixtures.filter((m) => m.homeTeamId === id || m.awayTeamId === id);

    const opponentName = (m: Match) => {
      const opponentId = m.homeTeamId === id ? m.awayTeamId : m.homeTeamId;
      return teams.find((t) => t.id === opponentId)?.name ?? opponentId;
    };

    const nextFixture = teamFixtures
      .filter((m) => m.status === 'upcoming')
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())[0];

    const nextMatch = nextFixture
      ? {
          ...nextFixture,
          opponentName: opponentName(nextFixture),
          venueTag: (nextFixture.homeTeamId === id ? 'dom.' : 'ext.') as 'dom.' | 'ext.',
        }
      : null;

    const lastResults: ResultLine[] = teamFixtures
      .filter((m) => m.status === 'played')
      .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())
      .slice(0, 3)
      .map((m) => {
        const isHome = m.homeTeamId === id;
        const ownScore = isHome ? m.homeScore! : m.awayScore!;
        const theirScore = isHome ? m.awayScore! : m.homeScore!;
        const result = ownScore > theirScore ? 'V' : ownScore === theirScore ? 'N' : 'D';
        return {
          matchId: m.id,
          opponent: opponentName(m),
          venueTag: isHome ? 'dom.' : 'ext.',
          result,
          score: `${ownScore}–${theirScore}`,
        };
      });

    const squad = players.filter((p) => p.teamId === id).slice(0, 6);

    return { team, nextMatch, lastResults, squad };
  });
}
