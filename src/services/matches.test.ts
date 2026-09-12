import { getMyFixtures, getMatch } from './matches';
import { fixtures } from '../data/fixtures';

test('getMyFixtures returns one row per fixture for every followed team, sorted by kickoff', async () => {
  const rows = await getMyFixtures(['fc-vallonnais', 'as-riverain']);
  expect(rows.length).toBeGreaterThanOrEqual(6);

  const kickoffOf = (matchId: string) =>
    new Date(fixtures.find((m) => m.id === matchId)!.kickoff).getTime();
  const timestamps = rows.map((r) => kickoffOf(r.matchId));
  expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
});

test('getMatch resolves a known match and rejects an unknown id', async () => {
  const match = await getMatch('m-j3-vallonnais');
  expect(match.homeScore).toBe(3);
  await expect(getMatch('does-not-exist')).rejects.toThrow('Match introuvable');
});
