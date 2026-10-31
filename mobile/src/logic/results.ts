import type { ApiMatch, MatchStatus, ResultTag } from '@/src/types';
import { toMatchStatus } from './matchStatus';

function sides(match: ApiMatch, teamId: string) {
  const isHome = match.home_team.id === teamId;
  return {
    isHome,
    own: isHome ? match.home_score : match.away_score,
    other: isHome ? match.away_score : match.home_score,
    opponent: isHome ? match.away_team : match.home_team,
  };
}

export function resultFor(match: ApiMatch, teamId: string): ResultTag | null {
  const { own, other } = sides(match, teamId);
  if (own === null || other === null) return null;
  if (own > other) return 'V';
  return own === other ? 'N' : 'D';
}

export function formatScore(match: ApiMatch, teamId: string): string {
  const { own, other } = sides(match, teamId);
  return `${own ?? '–'}–${other ?? '–'}`;
}

export function opponentOf(match: ApiMatch, teamId: string) {
  return sides(match, teamId).opponent;
}

export function isHomeFor(match: ApiMatch, teamId: string): boolean {
  return sides(match, teamId).isHome;
}

export function statusOf(match: ApiMatch): MatchStatus {
  return toMatchStatus(match.status);
}
