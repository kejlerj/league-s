import { formatCalendarDate, formatDateTime, formatDayMonth, formatTime, parseApiDate, toLocalDateParam } from './dateTime';

test('parseApiDate reads microsecond timestamps', () => {
  expect(parseApiDate('2026-10-05T18:09:28.963698Z').toISOString()).toBe('2026-10-05T18:09:28.963Z');
});

test('parseApiDate reads timestamps without fractional seconds', () => {
  expect(parseApiDate('2026-10-05T17:30:00Z').toISOString()).toBe('2026-10-05T17:30:00.000Z');
});

test('formatTime uses the device-local clock', () => {
  expect(formatTime(new Date(2026, 9, 5, 18, 9))).toBe('18:09');
});

test('formatDayMonth gives a French weekday, day and month', () => {
  expect(formatDayMonth(new Date(2026, 9, 5))).toBe('lun. 5 oct.');
});

test('formatDateTime joins the day and the time', () => {
  expect(formatDateTime(new Date(2026, 9, 5, 18, 9))).toBe('lun. 5 oct. · 18:09');
});

test('toLocalDateParam builds a YYYY-MM-DD string from the local date', () => {
  expect(toLocalDateParam(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
});

test('formatCalendarDate gives a French day, month and year for a YYYY-MM-DD date', () => {
  expect(formatCalendarDate('2026-08-29')).toBe('29 août 2026');
  expect(formatCalendarDate('2027-01-05')).toBe('5 janv. 2027');
});
