import { renderHook, waitFor } from '@testing-library/react-native';
import { useAsync } from './useAsync';

test('resolves data and flips loading to false', async () => {
  const { result } = renderHook(() => useAsync(() => Promise.resolve('ok'), []));
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toBe('ok');
  expect(result.current.error).toBeNull();
});

test('captures a rejected promise as error', async () => {
  const { result } = renderHook(() => useAsync(() => Promise.reject(new Error('boom')), []));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error?.message).toBe('boom');
});

test('reload re-runs the factory', async () => {
  let calls = 0;
  const factory = () => Promise.resolve(++calls);
  const { result } = renderHook(() => useAsync(factory, []));
  await waitFor(() => expect(result.current.data).toBe(1));
  result.current.reload();
  await waitFor(() => expect(result.current.data).toBe(2));
});
