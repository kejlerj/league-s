import { act, renderHook } from '@testing-library/react'
import { ApiError } from '@/api/client'
import { useSubmit } from '@/ui/useSubmit'

test('useSubmit ignores a second call while the first one is running', async () => {
  let release!: () => void
  const fn = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve
      }),
  )
  const { result } = renderHook(() => useSubmit(fn))
  act(() => {
    void result.current.submit()
    void result.current.submit()
  })
  expect(fn).toHaveBeenCalledTimes(1)
  expect(result.current.pending).toBe(true)
  await act(async () => {
    release()
  })
  expect(result.current.pending).toBe(false)
})

test('useSubmit exposes the message and resolves false on failure', async () => {
  const { result } = renderHook(() => useSubmit(() => Promise.reject(new ApiError(409, 'pris'))))
  let ok = true
  await act(async () => {
    ok = await result.current.submit()
  })
  expect(ok).toBe(false)
  expect(result.current.error).toBe('pris')
})

test('useSubmit applies the overrides and clears the error on the next success', async () => {
  let fail = true
  const { result } = renderHook(() =>
    useSubmit(() => (fail ? Promise.reject(new ApiError(409, 'x')) : Promise.resolve()), { 409: 'Conflit.' }),
  )
  await act(async () => {
    await result.current.submit()
  })
  expect(result.current.error).toBe('Conflit.')
  fail = false
  let ok = false
  await act(async () => {
    ok = await result.current.submit()
  })
  expect(ok).toBe(true)
  expect(result.current.error).toBeNull()
})

test('useSubmit puts each field error on its registered field and the rest in the form error', async () => {
  const fields = { name: '50 caractères maximum', 'tie_breakers[0]': 'doit valoir goal_difference', other: 'invalide' }
  const { result } = renderHook(() => useSubmit(() => Promise.reject(new ApiError(422, 'validation', fields))))
  result.current.field('name')
  result.current.field('tie_breakers')
  await act(async () => {
    await result.current.submit()
  })
  expect(result.current.field('name').error).toBe('50 caractères maximum')
  expect(result.current.field('tie_breakers').error).toBe('doit valoir goal_difference')
  expect(result.current.error).toBe('Champs invalides : other (invalide)')
})

test('useSubmit clears a field error when that field is edited, and every error on a new submit', async () => {
  let fail = true
  const { result } = renderHook(() =>
    useSubmit(() =>
      fail ? Promise.reject(new ApiError(422, 'validation', { name: 'obligatoire', logo: 'doit être une URL http ou https' })) : Promise.resolve(),
    ),
  )
  result.current.field('name')
  result.current.field('logo')
  await act(async () => {
    await result.current.submit()
  })
  act(() => {
    result.current.field('name').onInput()
  })
  expect(result.current.field('name').error).toBeNull()
  expect(result.current.field('logo').error).toBe('doit être une URL http ou https')

  fail = false
  await act(async () => {
    await result.current.submit()
  })
  expect(result.current.field('logo').error).toBeNull()
})
