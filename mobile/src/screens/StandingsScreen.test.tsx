import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';
import { StandingsScreen } from './StandingsScreen';
import * as leagueService from '../services/league';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { StandingRow } from '../types';
import { season } from '../test/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('../services/league');

const RECENT = season({ id: 'recent', league_id: 'l', name: '2026-2027', start_on: '2026-08-29', end_on: '2027-05-30' });
const PREVIOUS = season({ id: 'previous', league_id: 'l', name: '2025-2026', start_on: '2025-08-30', end_on: '2026-05-31' });

function row(team_id: string, team_name: string, rank: number): StandingRow {
  return { rank, team_id, team_name, team_logo: null, played: 5, won: 3, drawn: 1, lost: 1, goals_for: 9, goals_against: 5, goal_difference: 4, points: 10, fair_play_points: 0 };
}

beforeEach(() => {
  useAppStore.setState({ themeMode: 'system', leagueId: 'l', followsByLeague: {} });
  jest.mocked(leagueService.listSeasons).mockResolvedValue([RECENT, PREVIOUS]);
  jest.mocked(leagueService.getStandings).mockImplementation(async (_leagueId: string, seasonId: string) =>
    seasonId === RECENT.id ? [row('a', 'Team A', 1), row('b', 'Team B', 2)] : [row('c', 'Team C', 1)]
  );
});

test('shows the standings of the current season by default', async () => {
  render(<StandingsScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());
  expect(leagueService.getStandings).toHaveBeenCalledWith('l', RECENT.id);
});

test('switching the season loads that season standings', async () => {
  render(<StandingsScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());

  fireEvent.press(screen.getByTestId('segmented-tab-2025-2026'));

  await waitFor(() => expect(screen.getByText('Team C')).toBeTruthy());
  expect(leagueService.getStandings).toHaveBeenCalledWith('l', PREVIOUS.id);
});

test('a followed team row gets the follow tint', async () => {
  useAppStore.setState({ followsByLeague: { l: { a: { notifyLevel: 'full' } } } });
  render(<StandingsScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());

  expect(screen.getByTestId('standings-row-a').props.className).toContain('bg-accent/5');
});

test('each row shows the team logo, or its initial without one', async () => {
  jest.mocked(leagueService.getStandings).mockResolvedValue([
    { ...row('a', 'Team A', 1), team_logo: 'https://img.test/a.png' },
    row('b', 'Team B', 2),
  ]);
  render(<StandingsScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());

  expect(within(screen.getByTestId('standings-row-a')).getByTestId('crest-image').props.source).toEqual({ uri: 'https://img.test/a.png' });
  const rowB = within(screen.getByTestId('standings-row-b'));
  expect(rowB.queryByTestId('crest-image')).toBeNull();
  expect(rowB.getByTestId('crest-initial', { includeHiddenElements: true })).toHaveTextContent('T');
});

test('shows the error state when standings fail', async () => {
  jest.mocked(leagueService.getStandings).mockRejectedValueOnce(new Error('network'));
  render(<StandingsScreen />);
  await waitFor(() => expect(screen.getByText(fr.standings.error)).toBeTruthy());
});
