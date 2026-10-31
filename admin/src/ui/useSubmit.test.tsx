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
