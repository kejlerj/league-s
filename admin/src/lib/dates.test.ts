import { formatDateTime, localToUtc, today, utcToLocal } from '@/lib/dates'

test('localToUtc gives a UTC instant', () => {
  expect(localToUtc('2026-10-11T15:00')).toBe(new Date(2026, 9, 11, 15, 0).toISOString())
})

test('localToUtc and utcToLocal are inverses', () => {
  expect(utcToLocal(localToUtc('2026-10-11T15:00'))).toBe('2026-10-11T15:00')
  expect(utcToLocal(localToUtc('2026-01-05T08:05'))).toBe('2026-01-05T08:05')
})

test('formatDateTime(null) gives a dash', () => {
  expect(formatDateTime(null)).toBe('—')
})

test('formatDateTime shows the local date and time', () => {
  expect(formatDateTime(localToUtc('2026-10-11T15:00'))).toBe('11/10/2026 15:00')
})

test('today gives the local date as YYYY-MM-DD', () => {
  expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})
