import Constants from 'expo-constants';
import { fixedLeagueId } from './config';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));

const extra = () => (Constants.expoConfig as { extra: Record<string, unknown> }).extra;

afterEach(() => {
  delete extra().leagueId;
});

test('without a league in the build, no league is fixed', () => {
  expect(fixedLeagueId()).toBeNull();
});

test('the league of the build is the fixed league', () => {
  extra().leagueId = '01a10d58-8ae3-7c66-ac38-c7cac896cc65';
  expect(fixedLeagueId()).toBe('01a10d58-8ae3-7c66-ac38-c7cac896cc65');
});
