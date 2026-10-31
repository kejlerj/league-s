import { formatScore, isHomeFor, opponentOf, resultFor } from './results';
import type { ApiMatch } from '@/src/types';

function match(overrides: Partial<ApiMatch>): ApiMatch {
  return {
    id: 'm',
    season_id: 's',
    home_team: { id: 'home', name: 'Domicile FC', logo: null },
    away_team: { id: 'away', name: 'Extérieur FC', logo: null },
    matchday: 1,
    kickoff_at: '2026-10-05T18:00:00Z',
    status: 'finished',
    home_score: 3,
    away_score: 1,
    venue: null,
    referee: null,
    convocation_at: null,
    video_url: null,
    ...overrides,
  };
}

test('resultFor reads the result from the team perspective', () => {
  expect(resultFor(match({}), 'home')).toBe('V');
  expect(resultFor(match({}), 'away')).toBe('D');
  expect(resultFor(match({ home_score: 2, away_score: 2 }), 'home')).toBe('N');
});

test('resultFor is null before the scores are set', () => {
  expect(resultFor(match({ status: 'scheduled', home_score: null, away_score: null }), 'home')).toBeNull();
});

test('formatScore shows own score first', () => {
  expect(formatScore(match({}), 'home')).toBe('3–1');
  expect(formatScore(match({}), 'away')).toBe('1–3');
});

test('opponentOf and isHomeFor follow the perspective', () => {
  expect(opponentOf(match({}), 'home').name).toBe('Extérieur FC');
  expect(isHomeFor(match({}), 'away')).toBe(false);
});
