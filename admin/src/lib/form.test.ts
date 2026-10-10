import { emptyToNull, omitEmpty, toInt } from '@/lib/form'

test('emptyToNull', () => {
  expect(emptyToNull('  ')).toBeNull()
  expect(emptyToNull(' a ')).toBe('a')
})

test('toInt', () => {
  expect(toInt('')).toBeNull()
  expect(toInt('7')).toBe(7)
  expect(toInt('x')).toBeNull()
  expect(toInt('1.5')).toBeNull()
})

test('omitEmpty', () => {
  expect(omitEmpty({ a: 'x', b: null, c: '', d: 0, e: undefined })).toEqual({ a: 'x', d: 0 })
})
