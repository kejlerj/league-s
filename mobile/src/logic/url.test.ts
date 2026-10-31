import { isWebUrl } from './url';

test('accepts http and https urls only', () => {
  expect(isWebUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
  expect(isWebUrl('http://example.com')).toBe(true);
  expect(isWebUrl('javascript:alert(1)')).toBe(false);
  expect(isWebUrl('myapp://open')).toBe(false);
  expect(isWebUrl(null)).toBe(false);
});
