import { withLatency } from './_shared';
import { fixtures } from '../data/fixtures';
import { teams } from '../data/teams';
import { computeFixtureSlot } from '../logic/fixtureSlot';
import { SEASON_NOW } from '../data/seasonNow';
import type { FixtureRow, Match } from '../types';

const DAY_LABELS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function teamName(id: string): string {
  return teams.find((t) => t.id === id)?.name ?? id;
}

function formatWhen(date: Date): string {
  return `${DAY_LABELS[date.getUTCDay()]} ${date.getUTCDate()}`;
}

function formatTime(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

export function getMyFixtures(followedTeamIds: string[]): Promise<FixtureRow[]> {
  return withLatency(() => {
    const rows: FixtureRow[] = [];

    for (const teamId of followedTeamIds) {
      for (const match of fixtures) {
        if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) continue;

        const opponentId = match.homeTeamId === teamId ? match.awayTeamId : match.homeTeamId;
        const venueTag = match.homeTeamId === teamId ? 'dom.' : 'ext.';
        const kickoff = new Date(match.kickoff);
        const { slot, target } = computeFixtureSlot(match, SEASON_NOW, teamId);

        rows.push({
          matchId: match.id,
          when: formatWhen(kickoff),
          match: `${teamName(teamId)} — ${teamName(opponentId)}`,
          sub: `J${match.matchday} · ${venueTag === 'dom.' ? 'domicile' : 'extérieur'} · ${formatTime(kickoff)}`,
          slot,
          target,
        });
      }
    }

    const seen = new Set<string>();
    const deduped = rows.filter((row) => {
      if (seen.has(row.matchId)) return false;
      seen.add(row.matchId);
      return true;
    });

    return deduped.sort((a, b) => {
      const kickoffOf = (matchId: string) =>
        new Date(fixtures.find((m) => m.id === matchId)!.kickoff).getTime();
      return kickoffOf(b.matchId) - kickoffOf(a.matchId);
    });
  });
}

export function getMatch(id: string): Promise<Match> {
  return withLatency(() => {
    const match = fixtures.find((m) => m.id === id);
    if (!match) {
      throw new Error(`Match introuvable : ${id}`);
    }
    return match;
  });
}
