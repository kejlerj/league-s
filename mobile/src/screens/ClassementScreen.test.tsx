import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ClassementScreen } from './ClassementScreen';
import * as leagueService from '../services/league';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { StandingRow } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('../services/league');

const RECENT = { id: 'recent', league_id: 'l', name: '2026-2027', start_on: '2026-08-29T00:00:00Z', end_on: '2027-05-30T00:00:00Z' };
const PREVIOUS = { id: 'previous', league_id: 'l', name: '2025-2026', start_on: '2025-08-30T00:00:00Z', end_on: '2026-05-31T00:00:00Z' };

function row(team_id: string, team_name: string, rank: number): StandingRow {
  return { rank, team_id, team_name, played: 5, won: 3, drawn: 1, lost: 1, goals_for: 9, goals_against: 5, goal_difference: 4, points: 10 };
}

beforeEach(() => {
  useAppStore.setState({ themeMode: 'system', follows: {} });
  jest.mocked(leagueService.listSeasons).mockResolvedValue([RECENT, PREVIOUS]);
  jest.mocked(leagueService.getStandings).mockImplementation(async (seasonId: string) =>
    seasonId === RECENT.id ? [row('a', 'Team A', 1), row('b', 'Team B', 2)] : [row('c', 'Team C', 1)]
  );
});

test('shows the standings of the current season by default', async () => {
  render(<ClassementScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());
  expect(leagueService.getStandings).toHaveBeenCalledWith(RECENT.id);
});

test('switching the season loads that season standings', async () => {
  render(<ClassementScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());

  fireEvent.press(screen.getByTestId('segmented-tab-2025-2026'));

  await waitFor(() => expect(screen.getByText('Team C')).toBeTruthy());
  expect(leagueService.getStandings).toHaveBeenCalledWith(PREVIOUS.id);
});

test('a followed team row gets the follow tint', async () => {
  useAppStore.setState({ follows: { a: { notifyLevel: 'full' } } });
  render(<ClassementScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());

  expect(screen.getByTestId('standings-row-a').props.className).toContain('bg-accent/5');
});

test('shows the error state when standings fail', async () => {
  jest.mocked(leagueService.getStandings).mockRejectedValueOnce(new Error('network'));
  render(<ClassementScreen />);
  await waitFor(() => expect(screen.getByText(fr.classement.error)).toBeTruthy());
});
