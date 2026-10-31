import { apiGet, ApiError, buildQuery } from './client';

afterEach(() => {
  jest.restoreAllMocks();
});

test('buildQuery skips undefined params and encodes the rest', () => {
  expect(buildQuery({ team: 'a b', status: undefined })).toBe('?team=a%20b');
  expect(buildQuery({ status: undefined })).toBe('');
});

test('apiGet returns the parsed JSON body on success', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [{ id: 'x' }],
  });
  await expect(apiGet('/ping', { team: 't1' })).resolves.toEqual([{ id: 'x' }]);
  expect(globalThis.fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/ping\?team=t1$/)
  );
});

test('apiGet throws ApiError carrying the HTTP status on failure', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
  await expect(apiGet('/missing')).rejects.toMatchObject({ status: 404 });
  await expect(apiGet('/missing')).rejects.toBeInstanceOf(ApiError);
});
