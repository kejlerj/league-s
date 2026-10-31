import { pickCurrentSeason } from './season';
import type { Season } from '@/src/types';
import { season } from '../test/fixtures';

const recent: Season = season({ id: 'b', league_id: 'l', name: '2026-2027', start_on: '2026-08-29', end_on: '2027-05-30' });
const previous: Season = season({ id: 'a', league_id: 'l', name: '2025-2026', start_on: '2025-08-30', end_on: '2026-05-31' });
const seasons = [recent, previous];

test('picks the season whose dates contain now', () => {
  expect(pickCurrentSeason(seasons, new Date('2025-12-01T10:00:00Z'))).toBe(previous);
  expect(pickCurrentSeason(seasons, new Date('2026-10-05T10:00:00Z'))).toBe(recent);
});

test('counts the first and last days of a season, in local time', () => {
  expect(pickCurrentSeason(seasons, new Date(2025, 7, 30, 0, 30))).toBe(previous);
  expect(pickCurrentSeason(seasons, new Date(2026, 4, 31, 22, 0))).toBe(previous);
});

test('falls back to the most recent season between or after seasons', () => {
  expect(pickCurrentSeason(seasons, new Date('2026-07-01T10:00:00Z'))).toBe(recent);
  expect(pickCurrentSeason(seasons, new Date('2028-01-01T10:00:00Z'))).toBe(recent);
});

test('returns undefined when there are no seasons', () => {
  expect(pickCurrentSeason([], new Date())).toBeUndefined();
});
