import { toMatchStatus } from './matchStatus';

test('maps every API status to the app status', () => {
  expect(toMatchStatus('scheduled')).toBe('upcoming');
  expect(toMatchStatus('postponed')).toBe('upcoming');
  expect(toMatchStatus('live')).toBe('live');
  expect(toMatchStatus('finished')).toBe('played');
  expect(toMatchStatus('cancelled')).toBe('cancelled');
});
