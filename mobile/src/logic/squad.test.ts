import { byShirtNumber } from './squad';
import type { SquadRow } from '@/src/types';

function member(id: string, number: number): SquadRow {
  return { membership_id: id, player_id: id, firstname: id, lastname: id, icon: null, number, joined_on: '2026-08-29', left_on: null };
}

test('byShirtNumber lists the squad by shirt number without changing the input', () => {
  const squad = [member('c', 3), member('a', 1), member('d', 10), member('b', 2)];
  expect(byShirtNumber(squad).map((row) => row.number)).toEqual([1, 2, 3, 10]);
  expect(squad.map((row) => row.number)).toEqual([3, 1, 10, 2]);
});

test('players without a shirt number come last', () => {
  const squad = [{ ...member('n', 1), number: null }, member('a', 7)];
  expect(byShirtNumber(squad).map((row) => row.player_id)).toEqual(['a', 'n']);
});
