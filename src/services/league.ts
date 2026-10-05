import { apiGet } from '@/src/api/client';
import { LEAGUE_ID } from '@/src/config';
import type { Season, SquadRow, StandingRow, Team } from '@/src/types';

export function listSeasons(): Promise<Season[]> {
  return apiGet<Season[]>(`/leagues/${LEAGUE_ID}/seasons`);
}

export function getTeam(teamId: string): Promise<Team> {
  return apiGet<Team>(`/leagues/${LEAGUE_ID}/teams/${teamId}`);
}

export function getStandings(seasonId: string): Promise<StandingRow[]> {
  return apiGet<StandingRow[]>(`/leagues/${LEAGUE_ID}/seasons/${seasonId}/standings`);
}

export function getSquad(seasonId: string, teamId: string): Promise<SquadRow[]> {
  return apiGet<SquadRow[]>(`/leagues/${LEAGUE_ID}/seasons/${seasonId}/teams/${teamId}/squad`);
}
