import type { Match, FixtureSlot, FixtureTarget } from '../types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_LABELS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

export function computeFixtureSlot(
  match: Match,
  now: Date,
  perspectiveTeamId: string
): { slot: FixtureSlot; target: FixtureTarget } {
  if (match.status === 'played') {
    const homeIsPerspective = match.homeTeamId === perspectiveTeamId;
    const text = homeIsPerspective
      ? `${match.homeScore}–${match.awayScore}`
      : `${match.awayScore}–${match.homeScore}`;
    return { slot: { text, tone: 'score' }, target: { kind: 'match', id: match.id } };
  }

  if (match.status === 'live') {
    return {
      slot: { text: 'en cours', tone: 'live' },
      target: { kind: 'match', id: match.id },
    };
  }

  const kickoff = new Date(match.kickoff);
  const msUntilKickoff = kickoff.getTime() - now.getTime();

  if (match.odds && msUntilKickoff <= WEEK_MS) {
    const percent =
      match.homeTeamId === perspectiveTeamId ? match.odds.home : match.odds.away;
    return {
      slot: { text: `${percent} %`, tone: 'odds' },
      target: { kind: 'team', id: perspectiveTeamId },
    };
  }

  const openingDate = new Date(kickoff.getTime() - WEEK_MS);
  const dayLabel = DAY_LABELS[openingDate.getUTCDay()];
  return {
    slot: { text: `Cotes ${dayLabel}`, tone: 'date' },
    target: { kind: 'team', id: perspectiveTeamId },
  };
}
