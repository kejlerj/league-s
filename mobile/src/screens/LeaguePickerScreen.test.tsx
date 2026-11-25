import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LeaguePickerScreen } from './LeaguePickerScreen';
import * as leagueService from '../services/league';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import { fixedLeagueId } from '../config';

const mockReplace = jest.fn();
jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return {
    useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
    Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText>,
  };
});
jest.mock('../services/league');
jest.mock('../config');

const PARIS = { id: 'league-paris', name: 'Five Paris', logo: null };
const LYON = { id: 'league-lyon', name: 'Urban Lyon', logo: null };

beforeEach(() => {
  mockReplace.mockClear();
  useAppStore.setState({ themeMode: 'system', leagueId: null, followsByLeague: {} });
  jest.mocked(leagueService.listLeagues).mockResolvedValue([PARIS, LYON]);
  jest.mocked(fixedLeagueId).mockReturnValue(null);
});

test('with a league fixed by the build, the picker is skipped', () => {
  jest.mocked(fixedLeagueId).mockReturnValue(PARIS.id);
  jest.mocked(leagueService.listLeagues).mockClear();
  render(<LeaguePickerScreen />);
  expect(screen.getByText('redirect:/following')).toBeTruthy();
  expect(screen.queryByText(fr.leagues.title)).toBeNull();
  expect(leagueService.listLeagues).not.toHaveBeenCalled();
});

test('lists the leagues to choose from', async () => {
  render(<LeaguePickerScreen />);
  await waitFor(() => expect(screen.getByText('Five Paris')).toBeTruthy());
  expect(screen.getByText('Urban Lyon')).toBeTruthy();
  expect(screen.getByText(fr.leagues.title)).toBeTruthy();
});

test('choosing a league saves it and opens Following', async () => {
  render(<LeaguePickerScreen />);
  await waitFor(() => expect(screen.getByText('Urban Lyon')).toBeTruthy());

  fireEvent.press(screen.getByTestId('league-row-league-lyon'));

  expect(useAppStore.getState().leagueId).toBe(LYON.id);
  expect(mockReplace).toHaveBeenCalledWith('/following');
});

test('the current league is marked when changing league', async () => {
  useAppStore.setState({ leagueId: PARIS.id });
  render(<LeaguePickerScreen />);
  await waitFor(() => expect(screen.getByText('Five Paris')).toBeTruthy());

  expect(screen.getByTestId('league-current-league-paris')).toBeTruthy();
  expect(screen.queryByTestId('league-current-league-lyon')).toBeNull();
  expect(screen.getByText(`‹ ${fr.leagues.back}`)).toBeTruthy();
});

test('first launch has no back link', async () => {
  render(<LeaguePickerScreen />);
  await waitFor(() => expect(screen.getByText('Five Paris')).toBeTruthy());
  expect(screen.queryByText(`‹ ${fr.leagues.back}`)).toBeNull();
});

test('shows a message when there is no league', async () => {
  jest.mocked(leagueService.listLeagues).mockResolvedValue([]);
  render(<LeaguePickerScreen />);
  await waitFor(() => expect(screen.getByText(fr.leagues.empty)).toBeTruthy());
});

test('shows the error state and retries', async () => {
  jest.mocked(leagueService.listLeagues).mockRejectedValueOnce(new Error('network'));
  render(<LeaguePickerScreen />);
  await waitFor(() => expect(screen.getByText(fr.leagues.error)).toBeTruthy());

  fireEvent.press(screen.getByText(fr.common.retry));

  await waitFor(() => expect(screen.getByText('Five Paris')).toBeTruthy());
});
