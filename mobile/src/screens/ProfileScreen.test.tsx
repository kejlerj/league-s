import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from './ProfileScreen';
import * as leagueService from '../services/league';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../services/league');

const LEAGUE = 'league-paris';

beforeEach(() => {
  mockPush.mockClear();
  useAppStore.setState({
    themeMode: 'system',
    leagueId: LEAGUE,
    followsByLeague: {
      [LEAGUE]: { 'team-a': { notifyLevel: 'full' } },
      'league-lyon': { 'team-b': { notifyLevel: 'full' }, 'team-c': { notifyLevel: 'full' } },
    },
  });
  jest.mocked(leagueService.getLeague).mockResolvedValue({ id: LEAGUE, name: 'Five Paris', logo: null });
});

test('shows how many teams are followed in the current league', async () => {
  render(<ProfileScreen />);
  expect(screen.getByText('1')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Five Paris')).toBeTruthy());
});

test('shows the current league', async () => {
  render(<ProfileScreen />);
  await waitFor(() => expect(screen.getByText('Five Paris')).toBeTruthy());
  expect(leagueService.getLeague).toHaveBeenCalledWith(LEAGUE);
});

test('Changer opens the league picker', async () => {
  render(<ProfileScreen />);
  await waitFor(() => expect(screen.getByText('Five Paris')).toBeTruthy());

  fireEvent.press(screen.getByText(fr.profile.changeLeague));

  expect(mockPush).toHaveBeenCalledWith('/leagues');
});

test('the league name failing to load shows a message and still allows changing league', async () => {
  jest.mocked(leagueService.getLeague).mockRejectedValueOnce(new Error('network'));
  render(<ProfileScreen />);
  await waitFor(() => expect(screen.getByText(fr.profile.leagueError)).toBeTruthy());
  expect(screen.getByText(fr.profile.changeLeague)).toBeTruthy();
});

test('tapping Sombre updates the theme in the store', async () => {
  render(<ProfileScreen />);
  fireEvent.press(screen.getByTestId('segmented-tab-Sombre'));
  expect(useAppStore.getState().themeMode).toBe('dark');
  await waitFor(() => expect(screen.getByText('Five Paris')).toBeTruthy());
});
