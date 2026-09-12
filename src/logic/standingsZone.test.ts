import { computeStandingsZone } from './standingsZone';

test('rank 1 of 10 is promotion', () => {
  expect(computeStandingsZone(1, 10)).toBe('promotion');
});

test('rank 2 of 10 is playoff', () => {
  expect(computeStandingsZone(2, 10)).toBe('playoff');
});

test('the last two of 10 are relegation', () => {
  expect(computeStandingsZone(9, 10)).toBe('relegation');
  expect(computeStandingsZone(10, 10)).toBe('relegation');
});

test('a mid-table rank is none', () => {
  expect(computeStandingsZone(5, 10)).toBe('none');
});
