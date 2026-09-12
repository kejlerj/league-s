import { computeFixtureSlot } from './fixtureSlot';
import type { Match } from '../types';

const NOW = new Date('2026-09-12T09:00:00Z'); // Saturday

function baseMatch(overrides: Partial<Match>): Match {
  return {
    id: 'm1',
    matchday: 4,
    homeTeamId: 'fc-vallonnais',
    awayTeamId: 'us-coteaux',
    kickoff: '2026-09-15T15:00:00Z',
    venue: 'Stade des Marnes',
    status: 'upcoming',
    ...overrides,
  };
}

test('played, perspective team at home: score is home-away', () => {
  const match = baseMatch({ status: 'played', homeScore: 3, awayScore: 1 });
  const { slot, target } = computeFixtureSlot(match, NOW, 'fc-vallonnais');
  expect(slot).toEqual({ text: '3–1', tone: 'score' });
  expect(target).toEqual({ kind: 'match', id: 'm1' });
});

test('played, perspective team away: score is away-home', () => {
  const match = baseMatch({ status: 'played', homeScore: 3, awayScore: 1 });
  const { slot } = computeFixtureSlot(match, NOW, 'us-coteaux');
  expect(slot).toEqual({ text: '1–3', tone: 'score' });
});

test('live match shows "en cours" and targets the match page', () => {
  const match = baseMatch({ status: 'live' });
  const { slot, target } = computeFixtureSlot(match, NOW, 'fc-vallonnais');
  expect(slot).toEqual({ text: 'en cours', tone: 'live' });
  expect(target).toEqual({ kind: 'match', id: 'm1' });
});

test('upcoming within 7 days with odds shows the perspective team\'s percent and targets its team page', () => {
  const match = baseMatch({
    kickoff: '2026-09-15T15:00:00Z', // +3 days
    odds: { home: 34, draw: 19, away: 47 },
  });
  const { slot, target } = computeFixtureSlot(match, NOW, 'fc-vallonnais');
  expect(slot).toEqual({ text: '34 %', tone: 'odds' });
  expect(target).toEqual({ kind: 'team', id: 'fc-vallonnais' });
});

test('upcoming within 7 days, perspective team away, shows the away percent', () => {
  const match = baseMatch({
    kickoff: '2026-09-15T15:00:00Z',
    odds: { home: 34, draw: 19, away: 47 },
  });
  const { slot } = computeFixtureSlot(match, NOW, 'us-coteaux');
  expect(slot).toEqual({ text: '47 %', tone: 'odds' });
});

test('upcoming beyond 7 days shows the opening day, 7 days before kickoff', () => {
  const match = baseMatch({
    kickoff: '2026-09-22T15:00:00Z', // +10 days; opening day = +3 days = Tuesday
    odds: { home: 30, draw: 20, away: 50 },
  });
  const { slot, target } = computeFixtureSlot(match, NOW, 'fc-vallonnais');
  expect(slot).toEqual({ text: 'Cotes mar.', tone: 'date' });
  expect(target).toEqual({ kind: 'team', id: 'fc-vallonnais' });
});
