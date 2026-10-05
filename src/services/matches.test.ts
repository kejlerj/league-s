import { getFollowedFixtures } from './matches';
import type { ApiMatch } from '@/src/types';

function match(id: string, kickoff: string | null, home: string, away: string): ApiMatch {
  return {
    id,
    season_id: 's',
    home_team: { id: home, name: home, logo: null },
    away_team: { id: away, name: away, logo: null },
    matchday: 1,
    kickoff_at: kickoff,
    status: 'scheduled',
    home_score: null,
    away_score: null,
    venue: null,
    referee: null,
    convocation_at: null,
    video_url: null,
  };
}

const byTeam: Record<string, ApiMatch[]> = {
  a: [match('old', '2026-08-01T10:00:00Z', 'a', 'x'), match('shared', '2026-09-01T10:00:00Z', 'a', 'b')],
  b: [match('shared', '2026-09-01T10:00:00Z', 'a', 'b'), match('new', '2026-10-01T10:00:00Z', 'b', 'y')],
};

beforeEach(() => {
  globalThis.fetch = jest.fn(async (url: string) => {
    const team = new URL(url).searchParams.get('team') as string;
    return { ok: true, status: 200, json: async () => byTeam[team] };
  }) as unknown as typeof fetch;
});

test('merges followed teams, keeps one row per match, newest first', async () => {
  const rows = await getFollowedFixtures('season', ['a', 'b']);
  expect(rows.map((row) => row.match.id)).toEqual(['new', 'shared', 'old']);
});

test('a shared match keeps the perspective of the first followed team', async () => {
  const rows = await getFollowedFixtures('season', ['a', 'b']);
  expect(rows.find((row) => row.match.id === 'shared')?.teamId).toBe('a');
});
