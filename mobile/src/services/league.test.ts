import { getSquad } from './league';

let requested: string[] = [];

beforeEach(() => {
  requested = [];
  globalThis.fetch = jest.fn(async (url: string) => {
    requested.push(url);
    return { ok: true, status: 200, json: async () => [] };
  }) as unknown as typeof fetch;
});

test('getSquad asks for the current squad by default', async () => {
  await getSquad('l', 's', 't');
  expect(requested[0]).toMatch(/\/leagues\/l\/seasons\/s\/teams\/t\/squad$/);
});

test('getSquad with all asks for the departures too', async () => {
  await getSquad('l', 's', 't', { all: true });
  expect(requested[0]).toMatch(/\/leagues\/l\/seasons\/s\/teams\/t\/squad\?all=true$/);
});
