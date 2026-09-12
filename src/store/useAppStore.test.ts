import { useAppStore } from './useAppStore';

const DEFAULT_FOLLOWS = {
  'fc-vallonnais': { notifyLevel: 'full' as const },
  'as-riverain': { notifyLevel: 'result' as const },
};

beforeEach(() => {
  useAppStore.setState({
    themeMode: 'system',
    follows: DEFAULT_FOLLOWS,
    mvpVotes: {},
  });
});

test('seeds the default followed teams', () => {
  expect(useAppStore.getState().followedTeamIds().sort()).toEqual([
    'as-riverain',
    'fc-vallonnais',
  ]);
});

test('toggleFollow adds a team that is not yet followed', () => {
  expect(useAppStore.getState().isFollowing('us-coteaux')).toBe(false);
  useAppStore.getState().toggleFollow('us-coteaux');
  expect(useAppStore.getState().isFollowing('us-coteaux')).toBe(true);
});

test('toggleFollow removes a team that is already followed', () => {
  expect(useAppStore.getState().isFollowing('fc-vallonnais')).toBe(true);
  useAppStore.getState().toggleFollow('fc-vallonnais');
  expect(useAppStore.getState().isFollowing('fc-vallonnais')).toBe(false);
});

test('toggleMvpVote sets a vote then clears it on a second call', () => {
  expect(useAppStore.getState().hasVotedFor('m-j3-1', 'p-diarra')).toBe(false);
  useAppStore.getState().toggleMvpVote('m-j3-1', 'p-diarra');
  expect(useAppStore.getState().hasVotedFor('m-j3-1', 'p-diarra')).toBe(true);
  useAppStore.getState().toggleMvpVote('m-j3-1', 'p-diarra');
  expect(useAppStore.getState().hasVotedFor('m-j3-1', 'p-diarra')).toBe(false);
});

test('setThemeMode updates themeMode', () => {
  useAppStore.getState().setThemeMode('dark');
  expect(useAppStore.getState().themeMode).toBe('dark');
});
