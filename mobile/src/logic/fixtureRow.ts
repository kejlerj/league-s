import type { ApiMatch, MatchStatus } from '@/src/types';
import { formatDayMonth, formatTime, parseApiDate } from './dateTime';
import { formatScore, isHomeFor, statusOf } from './results';
import { fr } from '@/src/i18n/fr';

export type SlotTone = 'score' | 'live' | 'date' | 'muted';

export interface FixtureRow {
  matchId: string;
  status: MatchStatus;
  when: string;
  title: string;
  sub: string;
  slot: { text: string; tone: SlotTone };
  target: { kind: 'match'; id: string } | { kind: 'team'; id: string };
}

export function toFixtureRow(match: ApiMatch, teamId: string): FixtureRow {
  const status = statusOf(match);
  const isHome = isHomeFor(match, teamId);
  const kickoff = match.kickoff_at ? parseApiDate(match.kickoff_at) : null;

  const slot = (() => {
    switch (status) {
      case 'played':
        return { text: formatScore(match, teamId), tone: 'score' as const };
      case 'live':
        return { text: fr.fixture.live, tone: 'live' as const };
      case 'cancelled':
        return { text: fr.fixture.cancelled, tone: 'muted' as const };
      case 'upcoming':
        return { text: kickoff ? formatTime(kickoff) : fr.fixture.scheduleTbd, tone: 'date' as const };
    }
  })();

  return {
    matchId: match.id,
    status,
    when: kickoff ? formatDayMonth(kickoff) : '—',
    title: `${match.home_team.name} — ${match.away_team.name}`,
    sub: `${fr.fixture.matchdayShort(match.matchday)} · ${isHome ? fr.fixture.home : fr.fixture.away}`,
    slot,
    target: status === 'upcoming' ? { kind: 'team', id: teamId } : { kind: 'match', id: match.id },
  };
}
