import { getMatchEvents } from './matches';

test('getMatchEvents asks for the events of the match', async () => {
  const requested: string[] = [];
  globalThis.fetch = jest.fn(async (url: string) => {
    requested.push(url);
    return { ok: true, status: 200, json: async () => [] };
  }) as unknown as typeof fetch;

  await expect(getMatchEvents('l', 's', 'm')).resolves.toEqual([]);
  expect(requested[0]).toMatch(/\/leagues\/l\/seasons\/s\/matches\/m\/events$/);
});
