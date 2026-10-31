import { apiGet, pathSegment } from '@/src/api/client';
import type { CareerEntry, League, PlayerDetail, Season, SquadRow, StandingRow, Team } from '@/src/types';

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

export function getSquad(
  leagueId: string,
  seasonId: string,
  teamId: string,
  options: { all?: boolean } = {}
): Promise<SquadRow[]> {
  return apiGet<SquadRow[]>(
    `${leaguePath(leagueId)}/seasons/${pathSegment(seasonId)}/teams/${pathSegment(teamId)}/squad`,
    { all: options.all ? 'true' : undefined }
  );
}

export function getPlayer(leagueId: string, playerId: string): Promise<PlayerDetail> {
  return apiGet<PlayerDetail>(`${leaguePath(leagueId)}/players/${pathSegment(playerId)}`);
}

export function getPlayerCareer(leagueId: string, playerId: string): Promise<CareerEntry[]> {
  return apiGet<CareerEntry[]>(`${leaguePath(leagueId)}/players/${pathSegment(playerId)}/career`);
}

export function getSeason(leagueId: string, seasonId: string): Promise<Season> {
  return apiGet<Season>(`${leaguePath(leagueId)}/seasons/${pathSegment(seasonId)}`);
}

export function listTeamSeasons(leagueId: string, teamId: string): Promise<Season[]> {
  return apiGet<Season[]>(`${leaguePath(leagueId)}/teams/${pathSegment(teamId)}/seasons`);
}
