import { apiGet, pathSegment } from '@/src/api/client';
import { LEAGUE_ID } from '@/src/config';
import type { Season, SquadRow, StandingRow, Team } from '@/src/types';

export function listSeasons(): Promise<Season[]> {
  return apiGet<Season[]>(`/leagues/${pathSegment(LEAGUE_ID)}/seasons`);
}

export function getTeam(teamId: string): Promise<Team> {
  return apiGet<Team>(`/leagues/${pathSegment(LEAGUE_ID)}/teams/${pathSegment(teamId)}`);
}

export function getStandings(seasonId: string): Promise<StandingRow[]> {
  return apiGet<StandingRow[]>(`/leagues/${pathSegment(LEAGUE_ID)}/seasons/${pathSegment(seasonId)}/standings`);
}

export function getSquad(seasonId: string, teamId: string): Promise<SquadRow[]> {
  return apiGet<SquadRow[]>(`/leagues/${pathSegment(LEAGUE_ID)}/seasons/${pathSegment(seasonId)}/teams/${pathSegment(teamId)}/squad`);
}
