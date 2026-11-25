import { mergeAppState, migrateAppState, useAppStore } from './useAppStore';

const LEAGUE = '01a10d58-8ae3-7c66-ac38-c7cac896cc65';
const OTHER_LEAGUE = '01a10d58-8ae3-7c66-ac38-c7cac896cc66';
const LYON = '01a10d58-8ae5-723e-b3d1-8d75cbe828bb';
const PARIS = '01a10d58-8af4-7534-8b45-2ea2c3514099';

beforeEach(() => {
  useAppStore.setState({ themeMode: 'system', leagueId: LEAGUE, followsByLeague: {} });
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

test('setLeague changes the selected league', () => {
  useAppStore.getState().setLeague(OTHER_LEAGUE);
  expect(useAppStore.getState().leagueId).toBe(OTHER_LEAGUE);
});

test('follows are kept per league', () => {
  useAppStore.getState().toggleFollow(LYON);

  useAppStore.getState().setLeague(OTHER_LEAGUE);
  expect(useAppStore.getState().followedTeamIds()).toEqual([]);
  useAppStore.getState().toggleFollow(PARIS);

  useAppStore.getState().setLeague(LEAGUE);
  expect(useAppStore.getState().followedTeamIds()).toEqual([LYON]);
  expect(useAppStore.getState().isFollowing(PARIS)).toBe(false);
});

test('without a selected league nothing is followed and toggleFollow does nothing', () => {
  useAppStore.setState({ leagueId: null });
  useAppStore.getState().toggleFollow(LYON);
  expect(useAppStore.getState().followedTeamIds()).toEqual([]);
  expect(useAppStore.getState().followsByLeague).toEqual({});
});

test('migrating from version 2 drops the follows of the hard-coded league and keeps the theme', () => {
  const migrated = migrateAppState(
    { themeMode: 'dark', follows: { [LYON]: { notifyLevel: 'full' } } },
    2
  );
  expect(migrated).toEqual({ themeMode: 'dark', leagueId: null, followsByLeague: {} });
});

test('a fixed league replaces the stored league when the store loads', () => {
  const current = useAppStore.getState();
  const stored = { themeMode: 'dark' as const, leagueId: OTHER_LEAGUE, followsByLeague: { [LEAGUE]: { [LYON]: { notifyLevel: 'full' as const } } } };

  const merged = mergeAppState(stored, current, LEAGUE);

  expect(merged.leagueId).toBe(LEAGUE);
  expect(merged.themeMode).toBe('dark');
  expect(merged.followsByLeague).toEqual(stored.followsByLeague);
});

test('without a fixed league the stored league is kept', () => {
  const stored = { themeMode: 'system' as const, leagueId: OTHER_LEAGUE, followsByLeague: {} };
  expect(mergeAppState(stored, useAppStore.getState(), null).leagueId).toBe(OTHER_LEAGUE);
});

test('a fixed league is used on the first launch, before anything is stored', () => {
  expect(mergeAppState(undefined, { ...useAppStore.getState(), leagueId: null }, LEAGUE).leagueId).toBe(LEAGUE);
});
