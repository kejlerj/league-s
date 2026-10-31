import type { SquadRow } from '@/src/types';

function sortKey(row: SquadRow): number {
  return row.number ?? Number.POSITIVE_INFINITY;
}

export function byShirtNumber(squad: SquadRow[]): SquadRow[] {
  return [...squad].sort((a, b) => sortKey(a) - sortKey(b));
}
