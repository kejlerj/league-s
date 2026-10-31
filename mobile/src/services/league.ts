import { apiGet, pathSegment } from '@/src/api/client';
import type { League, Season, SquadRow, StandingRow, Team } from '@/src/types';

function leaguePath(leagueId: string): string {
  return `/leagues/${pathSegment(leagueId)}`;
}

export function listLeagues(): Promise<League[]> {
  return apiGet<League[]>('/leagues');
}

export function getLeague(leagueId: string): Promise<League> {
  return apiGet<League>(leaguePath(leagueId));
}

export function listSeasons(leagueId: string): Promise<Season[]> {
  return apiGet<Season[]>(`${leaguePath(leagueId)}/seasons`);
}

export function getTeam(leagueId: string, teamId: string): Promise<Team> {
  return apiGet<Team>(`${leaguePath(leagueId)}/teams/${pathSegment(teamId)}`);
}

export function getStandings(leagueId: string, seasonId: string): Promise<StandingRow[]> {
  return apiGet<StandingRow[]>(`${leaguePath(leagueId)}/seasons/${pathSegment(seasonId)}/standings`);
}

export function getSquad(leagueId: string, seasonId: string, teamId: string): Promise<SquadRow[]> {
  return apiGet<SquadRow[]>(`${leaguePath(leagueId)}/seasons/${pathSegment(seasonId)}/teams/${pathSegment(teamId)}/squad`);
}
