import { getStandings, getTopScorers, getTopAssists, getMvpRanking } from './standings';

test('getStandings returns 10 rows ordered by rank with computed zone and followed flag', async () => {
  const rows = await getStandings(['fc-vallonnais']);
  expect(rows).toHaveLength(10);
  expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(rows[0].zone).toBe('promotion');
  expect(rows[9].zone).toBe('relegation');
  expect(rows.find((r) => r.teamId === 'fc-vallonnais')?.followed).toBe(true);
  expect(rows.find((r) => r.teamId === 'us-coteaux')?.followed).toBe(false);
});

test('getTopScorers/getTopAssists/getMvpRanking each return 8 rows', async () => {
  expect(await getTopScorers()).toHaveLength(8);
  expect(await getTopAssists()).toHaveLength(8);
  expect(await getMvpRanking()).toHaveLength(8);
});
