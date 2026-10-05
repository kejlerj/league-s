import { apiGet } from '@/src/api/client';
import { LEAGUE_ID } from '@/src/config';
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

export function listMatches(seasonId: string, query: MatchQuery = {}): Promise<ApiMatch[]> {
  return apiGet<ApiMatch[]>(`/leagues/${LEAGUE_ID}/seasons/${seasonId}/matches`, query);
}

export function getMatch(seasonId: string, matchId: string): Promise<ApiMatch> {
  return apiGet<ApiMatch>(`/leagues/${LEAGUE_ID}/seasons/${seasonId}/matches/${matchId}`);
}

function kickoffTime(match: ApiMatch): number {
  return match.kickoff_at ? parseApiDate(match.kickoff_at).getTime() : Number.NEGATIVE_INFINITY;
}

export async function getFollowedFixtures(seasonId: string, teamIds: string[]): Promise<FollowedMatch[]> {
  const perTeam = await Promise.all(
    teamIds.map(async (teamId) =>
      (await listMatches(seasonId, { team: teamId })).map((match) => ({ match, teamId }))
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
