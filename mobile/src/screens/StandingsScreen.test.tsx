import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';
import { StandingsScreen } from './StandingsScreen';
import * as leagueService from '../services/league';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { RankingRow, StandingRow } from '../types';
import { season } from '../test/fixtures';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../services/league');

const RECENT = season({ id: 'recent', league_id: 'l', name: '2026-2027', start_on: '2026-08-29', end_on: '2027-05-30' });
const PREVIOUS = season({ id: 'previous', league_id: 'l', name: '2025-2026', start_on: '2025-08-30', end_on: '2026-05-31' });

function row(team_id: string, team_name: string, rank: number): StandingRow {
  return { rank, team_id, team_name, team_logo: null, played: 5, won: 3, drawn: 1, lost: 1, goals_for: 9, goals_against: 5, goal_difference: 4, points: 10, fair_play_points: 0 };
}

beforeEach(() => {
  jest.clearAllMocks();
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

function ranking(player_id: string, firstname: string, lastname: string, rank: number, value: number): RankingRow {
  return { rank, player_id, firstname, lastname, team_id: 'a', team_name: 'Team A', value };
}

test('the Buteurs tab lists the scorers of the season', async () => {
  jest.mocked(leagueService.getScorers).mockResolvedValue([
    ranking('p1', 'Malik', 'Diarra', 1, 7),
    ranking('p2', 'Léo', 'Dupont', 2, 1),
  ]);
  render(<StandingsScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());

  fireEvent.press(screen.getByTestId(`segmented-tab-${fr.standings.tabs[1]}`));

  await waitFor(() => expect(screen.getByText('Malik Diarra')).toBeTruthy());
  expect(leagueService.getScorers).toHaveBeenCalledWith('l', RECENT.id);
  expect(screen.getByText(fr.standings.scorersTitle)).toBeTruthy();
  const first = within(screen.getByTestId('ranking-row-p1'));
  expect(first.getByText('1')).toBeTruthy();
  expect(first.getByText('Team A')).toBeTruthy();
  expect(first.getByText('7 buts')).toBeTruthy();
  expect(within(screen.getByTestId('ranking-row-p2')).getByText('1 but')).toBeTruthy();
});

test('the Passeurs tab lists the assists, and a row opens the player', async () => {
  jest.mocked(leagueService.getAssists).mockResolvedValue([ranking('p1', 'Malik', 'Diarra', 1, 3)]);
  render(<StandingsScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());

  fireEvent.press(screen.getByTestId(`segmented-tab-${fr.standings.tabs[2]}`));

  await waitFor(() => expect(screen.getByText('3 passes')).toBeTruthy());
  expect(leagueService.getAssists).toHaveBeenCalledWith('l', RECENT.id);
  expect(screen.getByText(fr.standings.assistsTitle)).toBeTruthy();
  fireEvent.press(screen.getByText('Malik Diarra'));
  expect(mockPush).toHaveBeenCalledWith('/standings/player/p1');
});

test.each([
  [1, 'getScorers', fr.standings.noScorers],
  [2, 'getAssists', fr.standings.noAssists],
] as const)('tab %i shows its empty state', async (tab, service, message) => {
  jest.mocked(leagueService[service]).mockResolvedValue([]);
  render(<StandingsScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());

  fireEvent.press(screen.getByTestId(`segmented-tab-${fr.standings.tabs[tab]}`));

  await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
});

test('a rankings error shows a retry', async () => {
  jest.mocked(leagueService.getScorers).mockRejectedValueOnce(new Error('network')).mockResolvedValue([ranking('p1', 'Malik', 'Diarra', 1, 7)]);
  render(<StandingsScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());

  fireEvent.press(screen.getByTestId(`segmented-tab-${fr.standings.tabs[1]}`));

  await waitFor(() => expect(screen.getByText(fr.standings.rankingError)).toBeTruthy());
  fireEvent.press(screen.getByText(fr.common.retry));
  await waitFor(() => expect(screen.getByText('Malik Diarra')).toBeTruthy());
});

test('the rankings follow the selected season, and are not loaded on the Général tab', async () => {
  jest.mocked(leagueService.getScorers).mockResolvedValue([]);
  render(<StandingsScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());
  expect(leagueService.getScorers).not.toHaveBeenCalled();

  fireEvent.press(screen.getByTestId('segmented-tab-2025-2026'));
  fireEvent.press(screen.getByTestId(`segmented-tab-${fr.standings.tabs[1]}`));

  await waitFor(() => expect(leagueService.getScorers).toHaveBeenCalledWith('l', PREVIOUS.id));
});

test('switching from Buteurs to Passeurs never shows the scorers as passers', async () => {
  jest.mocked(leagueService.getScorers).mockResolvedValue([ranking('p1', 'Malik', 'Diarra', 1, 7)]);
  jest.mocked(leagueService.getAssists).mockReturnValue(new Promise(() => {}));
  render(<StandingsScreen />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());
  fireEvent.press(screen.getByTestId(`segmented-tab-${fr.standings.tabs[1]}`));
  await waitFor(() => expect(screen.getByText('Malik Diarra')).toBeTruthy());

  fireEvent.press(screen.getByTestId(`segmented-tab-${fr.standings.tabs[2]}`));

  await waitFor(() => expect(screen.queryByText('Malik Diarra')).toBeNull());
  expect(screen.queryByText('7 passes')).toBeNull();
});
