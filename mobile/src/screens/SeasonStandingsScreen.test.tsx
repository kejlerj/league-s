import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SeasonStandingsScreen } from './SeasonStandingsScreen';
import * as leagueService from '../services/league';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { StandingRow } from '../types';
import { season } from '../test/fixtures';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));
jest.mock('../services/league');

const SEASON = season({ id: 'season-0', league_id: 'l', name: '2025-2026', start_on: '2025-08-30', end_on: '2026-05-31' });

function row(team_id: string, team_name: string, rank: number): StandingRow {
  return { rank, team_id, team_name, played: 18, won: 10, drawn: 4, lost: 4, goals_for: 30, goals_against: 20, goal_difference: 10, points: 34 };
}

beforeEach(() => {
  mockPush.mockClear();
  useAppStore.setState({ leagueId: 'l', followsByLeague: {} });
  jest.mocked(leagueService.getSeason).mockResolvedValue(SEASON);
  jest.mocked(leagueService.getStandings).mockResolvedValue([row('a', 'Team A', 1), row('team-us', 'US Bastille', 2)]);
});

test('shows a skeleton while loading', async () => {
  render(<SeasonStandingsScreen seasonId={SEASON.id} teamId="team-us" origin="standings" />);
  expect(screen.getByTestId('skeleton')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('US Bastille')).toBeTruthy());
});

test('shows the standings of that season with the team highlighted', async () => {
  render(<SeasonStandingsScreen seasonId={SEASON.id} teamId="team-us" origin="standings" />);

  await waitFor(() => expect(screen.getByText('US Bastille')).toBeTruthy());
  expect(leagueService.getSeason).toHaveBeenCalledWith('l', SEASON.id);
  expect(leagueService.getStandings).toHaveBeenCalledWith('l', SEASON.id);
  expect(screen.getByText(fr.seasonStandings.title('2025-2026'))).toBeTruthy();
  expect(screen.getByTestId('standings-row-team-us').props.className).toContain('bg-accent/5');
  expect(screen.getByTestId('standings-row-a').props.className ?? '').not.toContain('bg-accent/5');
});

test('tapping a row opens that team in the same tab', async () => {
  render(<SeasonStandingsScreen seasonId={SEASON.id} teamId="team-us" origin="following" />);
  await waitFor(() => expect(screen.getByText('Team A')).toBeTruthy());

  fireEvent.press(screen.getByText('Team A'));

  expect(mockPush).toHaveBeenCalledWith('/following/team/a');
});

test('a season without standings says so', async () => {
  jest.mocked(leagueService.getStandings).mockResolvedValue([]);
  render(<SeasonStandingsScreen seasonId={SEASON.id} teamId="team-us" origin="standings" />);
  await waitFor(() => expect(screen.getByText(fr.standings.empty)).toBeTruthy());
});

test('shows the error state and retries', async () => {
  jest.mocked(leagueService.getStandings).mockRejectedValueOnce(new Error('network'));
  render(<SeasonStandingsScreen seasonId={SEASON.id} teamId="team-us" origin="standings" />);
  await waitFor(() => expect(screen.getByText(fr.seasonStandings.error)).toBeTruthy());

  fireEvent.press(screen.getByText(fr.common.retry));

  await waitFor(() => expect(screen.getByText('US Bastille')).toBeTruthy());
});
