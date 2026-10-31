import { apiGet, pathSegment } from '@/src/api/client';
import { parseApiDate } from '@/src/logic/dateTime';
import type { ApiMatch, ApiMatchStatus } from '@/src/types';

export type MatchQuery = {
  team?: string;
  status?: ApiMatchStatus;
  from?: string;
};

export interface FollowedMatch {
  match: ApiMatch;
  teamId: string;
}

export function listMatches(leagueId: string, seasonId: string, query: MatchQuery = {}): Promise<ApiMatch[]> {
  return apiGet<ApiMatch[]>(`/leagues/${pathSegment(leagueId)}/seasons/${pathSegment(seasonId)}/matches`, query);
}

export function getMatch(leagueId: string, seasonId: string, matchId: string): Promise<ApiMatch> {
  return apiGet<ApiMatch>(`/leagues/${pathSegment(leagueId)}/seasons/${pathSegment(seasonId)}/matches/${pathSegment(matchId)}`);
}

function kickoffTime(match: ApiMatch): number {
  return match.kickoff_at ? parseApiDate(match.kickoff_at).getTime() : Number.NEGATIVE_INFINITY;
}

export async function getFollowedFixtures(leagueId: string, seasonId: string, teamIds: string[]): Promise<FollowedMatch[]> {
  const perTeam = await Promise.all(
    teamIds.map(async (teamId) =>
      (await listMatches(leagueId, seasonId, { team: teamId })).map((match) => ({ match, teamId }))
    )
  );
  const seen = new Set<string>();
  const unique = perTeam.flat().filter(({ match }) => {
    if (seen.has(match.id)) return false;
    seen.add(match.id);
    return true;
  });
  return unique.sort((a, b) => kickoffTime(b.match) - kickoffTime(a.match));
}
