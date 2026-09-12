import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ClassementScreen } from './ClassementScreen';
import * as standingsService from '../services/standings';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

beforeEach(() => {
  jest.spyOn(standingsService, 'getStandings').mockResolvedValue([
    { rank: 1, teamId: 't1', teamName: 'US Coteaux', played: 3, goalDiff: 6, points: 9, zone: 'promotion', followed: false },
    { rank: 2, teamId: 't2', teamName: 'FC Vallonnais', played: 3, goalDiff: 4, points: 7, zone: 'none', followed: true },
  ]);
  jest.spyOn(standingsService, 'getTopScorers').mockResolvedValue([
    { rank: 1, playerId: 'p1', name: 'Malik Diarra', teamName: 'FC Vallonnais', value: 5, unit: 'buts' },
  ]);
  jest.spyOn(standingsService, 'getTopAssists').mockResolvedValue([]);
  jest.spyOn(standingsService, 'getMvpRanking').mockResolvedValue([]);
});

test('shows the standings table by default', async () => {
  render(<ClassementScreen />);
  await waitFor(() => expect(screen.getByText('US Coteaux')).toBeTruthy());
});

test('a followed team\'s standings row gets the accent tint, unlike a non-followed one', async () => {
  render(<ClassementScreen />);
  await waitFor(() => expect(screen.getByText('US Coteaux')).toBeTruthy());

  const followedRow = screen.getByTestId('standings-row-t2');
  const nonFollowedRow = screen.getByTestId('standings-row-t1');
  expect(followedRow.props.className).toEqual(expect.stringContaining('bg-accent/5'));
  expect(nonFollowedRow.props.className ?? '').not.toEqual(expect.stringContaining('bg-accent/5'));
});

test('switching to the Buteurs tab shows the scorers list', async () => {
  render(<ClassementScreen />);
  await waitFor(() => expect(screen.getByText('US Coteaux')).toBeTruthy());

  fireEvent.press(screen.getByTestId('segmented-tab-Buteurs'));

  await waitFor(() => expect(screen.getByText('Malik Diarra')).toBeTruthy());
});
