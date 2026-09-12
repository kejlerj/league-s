import type { FixtureRow, ListItem } from '../types';

const SHOP_ROW_INTERVAL = 5;

export function injectShopRows(fixtures: FixtureRow[]): ListItem[] {
  const items: ListItem[] = [];
  fixtures.forEach((row, index) => {
    items.push({ kind: 'fixture', row });
    if ((index + 1) % SHOP_ROW_INTERVAL === 0) {
      items.push({ kind: 'shop' });
    }
  });
  return items;
}
