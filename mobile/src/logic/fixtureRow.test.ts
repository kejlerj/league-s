import { toFixtureRow } from './fixtureRow';
import type { ApiMatch } from '@/src/types';

function match(overrides: Partial<ApiMatch>): ApiMatch {
  return {
    id: 'm1',
    season_id: 's',
    home_team: { id: 'home', name: 'Domicile FC', logo: null },
    away_team: { id: 'away', name: 'Extérieur FC', logo: null },
    matchday: 4,
    kickoff_at: new Date(2026, 9, 5, 18, 9).toISOString(),
    status: 'scheduled',
    home_score: null,
    away_score: null,
    venue: null,
    referee: null,
    convocation_at: null,
    video_url: null,
    ...overrides,
  };
}

test('a finished match shows the score from the perspective team and links to the match', () => {
  const row = toFixtureRow(match({ status: 'finished', home_score: 3, away_score: 1 }), 'away');
  expect(row.status).toBe('played');
  expect(row.slot).toEqual({ text: '1–3', tone: 'score' });
  expect(row.target).toEqual({ kind: 'match', id: 'm1' });
});

test('a live match shows en cours', () => {
  const row = toFixtureRow(match({ status: 'live', home_score: 1, away_score: 0 }), 'home');
  expect(row.slot.text).toBe('en cours');
  expect(row.target.kind).toBe('match');
});

test('an upcoming match shows the local kickoff time and links to the team', () => {
  const row = toFixtureRow(match({}), 'home');
  expect(row.slot).toEqual({ text: '18:09', tone: 'date' });
  expect(row.when).toBe('lun. 5 oct.');
  expect(row.sub).toBe('J4 · domicile');
  expect(row.target).toEqual({ kind: 'team', id: 'home' });
});

test('a postponed match without a kickoff shows a placeholder and no date', () => {
  const row = toFixtureRow(match({ status: 'postponed', kickoff_at: null }), 'home');
  expect(row.slot.text).toBe('à définir');
  expect(row.when).toBe('—');
});

test('a cancelled match is shown as cancelled', () => {
  const row = toFixtureRow(match({ status: 'cancelled' }), 'home');
  expect(row.status).toBe('cancelled');
  expect(row.slot).toEqual({ text: 'annulé', tone: 'muted' });
});

test('the row carries both teams with their logos', () => {
  const row = toFixtureRow(match({ home_team: { id: 'home', name: 'Domicile FC', logo: 'https://img.test/home.png' } }), 'home');
  expect(row.home).toEqual({ id: 'home', name: 'Domicile FC', logo: 'https://img.test/home.png' });
  expect(row.away).toEqual({ id: 'away', name: 'Extérieur FC', logo: null });
});
