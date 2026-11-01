import type { ApiMatch, ResultTag, SquadRow, StandingRow } from '@/src/types';
import { parseApiDate } from './dateTime';
import { isHomeFor, opponentOf, resultFor, formatScore } from './results';
import { byShirtNumber } from './squad';

export interface NextMatch {
  matchId: string;
  opponentName: string;
  isHome: boolean;
  kickoffAt: Date | null;
  venue: string | null;
  convocationAt: Date | null;
}

export interface ResultLine {
  matchId: string;
  opponentName: string;
  isHome: boolean;
  result: ResultTag;
  score: string;
}

export interface TeamDetail {
  standing: StandingRow | null;
  form: ResultTag[];
  nextMatch: NextMatch | null;
  lastResults: ResultLine[];
  squad: SquadRow[];
}

interface TeamDetailInput {
  teamId: string;
  standings: StandingRow[];
  finished: ApiMatch[];
  scheduled: ApiMatch[];
  squad: SquadRow[];
}

const FORM_LENGTH = 5;
const LAST_RESULTS_LENGTH = 3;

function byMatchdayAsc(a: ApiMatch, b: ApiMatch) {
  return a.matchday - b.matchday;
}

function byKickoffAsc(a: ApiMatch, b: ApiMatch) {
  const aTime = a.kickoff_at ? parseApiDate(a.kickoff_at).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.kickoff_at ? parseApiDate(b.kickoff_at).getTime() : Number.POSITIVE_INFINITY;
  return aTime - bTime;
}

export function buildTeamDetail({ teamId, standings, finished, scheduled, squad }: TeamDetailInput): TeamDetail {
  const playedInOrder = finished
    .filter((match) => resultFor(match, teamId) !== null)
    .sort(byMatchdayAsc);

  const form = playedInOrder
    .slice(-FORM_LENGTH)
    .map((match) => resultFor(match, teamId) as ResultTag);

  const lastResults: ResultLine[] = playedInOrder
    .slice(-LAST_RESULTS_LENGTH)
    .reverse()
    .map((match) => ({
      matchId: match.id,
      opponentName: opponentOf(match, teamId).name,
      isHome: isHomeFor(match, teamId),
      result: resultFor(match, teamId) as ResultTag,
      score: formatScore(match, teamId),
    }));

  const next = [...scheduled].sort(byKickoffAsc)[0];
  const nextMatch: NextMatch | null = next
    ? {
        matchId: next.id,
        opponentName: opponentOf(next, teamId).name,
        isHome: isHomeFor(next, teamId),
        kickoffAt: next.kickoff_at ? parseApiDate(next.kickoff_at) : null,
        venue: next.venue,
        convocationAt: next.convocation_at ? parseApiDate(next.convocation_at) : null,
      }
    : null;

  return {
    standing: standings.find((row) => row.team_id === teamId) ?? null,
    form,
    nextMatch,
    lastResults,
    squad: byShirtNumber(squad),
  };
}
