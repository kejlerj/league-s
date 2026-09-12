import { formatMatchDate, formatMatchDateTime, formatShortDate } from './formatDate';

test('formatMatchDate renders the UTC weekday, day and month', () => {
  expect(formatMatchDate('2026-09-07T15:00:00Z')).toBe('lun. 7 sept.');
});

test('formatMatchDateTime appends the UTC time after the date', () => {
  expect(formatMatchDateTime('2026-09-07T15:00:00Z')).toBe('lun. 7 sept. · 15:00');
});

test('formatShortDate renders just the day and month', () => {
  expect(formatShortDate('2026-09-15T15:00:00Z')).toBe('15 sept.');
});
