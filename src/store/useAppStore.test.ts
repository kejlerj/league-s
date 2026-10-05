import { migrateAppState, useAppStore } from './useAppStore';

const LYON = '01a10d58-8ae5-723e-b3d1-8d75cbe828bb';
const PARIS = '01a10d58-8af4-7534-8b45-2ea2c3514099';

beforeEach(() => {
  useAppStore.setState({ themeMode: 'system', follows: {} });
});

test('starts with no followed teams', () => {
  expect(useAppStore.getState().followedTeamIds()).toEqual([]);
});

test('toggleFollow adds a team that is not yet followed', () => {
  useAppStore.getState().toggleFollow(LYON);
  expect(useAppStore.getState().isFollowing(LYON)).toBe(true);
});

test('toggleFollow removes a team that is already followed', () => {
  useAppStore.getState().toggleFollow(LYON);
  useAppStore.getState().toggleFollow(LYON);
  expect(useAppStore.getState().isFollowing(LYON)).toBe(false);
});

test('followedTeamIds returns the same array until the follows change', () => {
  useAppStore.getState().toggleFollow(LYON);
  const first = useAppStore.getState().followedTeamIds();
  expect(useAppStore.getState().followedTeamIds()).toBe(first);
  useAppStore.getState().toggleFollow(PARIS);
  expect(useAppStore.getState().followedTeamIds().sort()).toEqual([LYON, PARIS].sort());
});

test('setThemeMode updates themeMode', () => {
  useAppStore.getState().setThemeMode('dark');
  expect(useAppStore.getState().themeMode).toBe('dark');
});

test('migrating from version 1 drops the old mock follows and keeps the theme', () => {
  const migrated = migrateAppState<{ themeMode: string; follows: Record<string, { notifyLevel: 'full' | 'result' }> }>(
    { themeMode: 'dark', follows: { 'fc-vallonnais': { notifyLevel: 'full' } } },
    1
  );
  expect(migrated.follows).toEqual({});
  expect(migrated.themeMode).toBe('dark');
});
