import { injectShopRows } from './injectShopRows';
import type { FixtureRow } from '../types';

function rows(count: number): FixtureRow[] {
  return Array.from({ length: count }, (_, i) => ({
    matchId: `m${i + 1}`,
    when: 'Dim. 14',
    match: `Match ${i + 1}`,
    sub: 'J4',
    slot: { text: 'x', tone: 'score' as const },
    target: { kind: 'match' as const, id: `m${i + 1}` },
  }));
}

test('no shop row for fewer than 5 fixtures', () => {
  const items = injectShopRows(rows(4));
  expect(items.filter((i) => i.kind === 'shop')).toHaveLength(0);
  expect(items).toHaveLength(4);
});

test('one shop row after the 5th fixture, preserving order', () => {
  const items = injectShopRows(rows(6));
  expect(items).toHaveLength(7);
  expect(items[5]).toEqual({ kind: 'shop' });
  expect(items.map((i) => (i.kind === 'fixture' ? i.row.matchId : 'shop'))).toEqual([
    'm1', 'm2', 'm3', 'm4', 'm5', 'shop', 'm6',
  ]);
});

test('shop rows at indices 5 and 11 for 12 fixtures', () => {
  const items = injectShopRows(rows(12));
  expect(items[5]).toEqual({ kind: 'shop' });
  expect(items[11]).toEqual({ kind: 'shop' });
  expect(items.filter((i) => i.kind === 'shop')).toHaveLength(2);
});
