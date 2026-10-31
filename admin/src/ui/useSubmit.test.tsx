import { act, renderHook } from '@testing-library/react'
import { ApiError } from '@/api/client'
import { useSubmit } from '@/ui/useSubmit'

test('useSubmit ignore le second appel tant que le premier est en cours', async () => {
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

test("useSubmit expose le message et résout false en cas d'échec", async () => {
  const { result } = renderHook(() => useSubmit(() => Promise.reject(new ApiError(409, 'pris'))))
  let ok = true
  await act(async () => {
    ok = await result.current.submit()
  })
  expect(ok).toBe(false)
  expect(result.current.error).toBe('pris')
})

test('useSubmit applique les overrides et efface l\'erreur au succès suivant', async () => {
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
