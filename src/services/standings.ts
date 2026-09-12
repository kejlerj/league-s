import { withLatency } from './_shared';
import { teams } from '../data/teams';
import { topScorers, topAssists, mvpRanking } from '../data/players';
import { computeStandingsZone } from '../logic/standingsZone';
import type { StandingsRow, PeopleRow } from '../types';

export function getStandings(followedTeamIds: string[] = []): Promise<StandingsRow[]> {
  return withLatency(() =>
    [...teams]
      .sort((a, b) => a.rank - b.rank)
      .map((team) => ({
        rank: team.rank,
        teamId: team.id,
        teamName: team.name,
        played: team.played,
        goalDiff: team.goalDiff,
        points: team.points,
        zone: computeStandingsZone(team.rank, teams.length),
        followed: followedTeamIds.includes(team.id),
      }))
  );
}

export function getTopScorers(): Promise<PeopleRow[]> {
  return withLatency(() => topScorers);
}

export function getTopAssists(): Promise<PeopleRow[]> {
  return withLatency(() => topAssists);
}

export function getMvpRanking(): Promise<PeopleRow[]> {
  return withLatency(() => mvpRanking);
}
