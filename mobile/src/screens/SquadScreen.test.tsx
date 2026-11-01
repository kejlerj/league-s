import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SquadScreen } from './SquadScreen';
import * as leagueService from '../services/league';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { SquadRow } from '../types';
import { season } from '../test/fixtures';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));
jest.mock('../services/league');

const SEASON = season({ id: 'season-1', league_id: 'l', name: '2026-2027', start_on: '2026-08-29', end_on: '2027-05-30' });
const TEAM_ID = 'team-us';

function member(id: string, firstname: string, lastname: string, number: number, left_on: string | null): SquadRow {
  return { membership_id: `m-${id}`, player_id: id, firstname, lastname, icon: null, number, joined_on: '2026-08-29', left_on, goals: 0, assists: 0 };
}

beforeEach(() => {
  mockPush.mockClear();
  useAppStore.setState({ leagueId: 'l' });
  jest.mocked(leagueService.listSeasons).mockResolvedValue([SEASON]);
  jest.mocked(leagueService.getTeam).mockResolvedValue({ id: TEAM_ID, league_id: 'l', name: 'US Bastille', logo: null });
  jest.mocked(leagueService.getSquad).mockResolvedValue([
    member('p1', 'David', 'Benali', 4, null),
    member('p2', 'Karim', 'Sow', 9, '2026-10-12'),
  ]);
});

test('shows a skeleton while loading', async () => {
  render(<SquadScreen teamId={TEAM_ID} origin="standings" />);
  expect(screen.getByTestId('skeleton')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('David Benali')).toBeTruthy());
});

test('players are listed by shirt number', async () => {
  jest.mocked(leagueService.getSquad).mockResolvedValue([
    member('p3', 'Chris', 'Three', 3, null),
    member('p1', 'Alex', 'One', 1, null),
    member('p2', 'Bob', 'Two', 2, null),
  ]);
  render(<SquadScreen teamId={TEAM_ID} origin="standings" />);
  await waitFor(() => expect(screen.getByText('Alex One')).toBeTruthy());

  const names = screen.getAllByText(/^(Alex One|Bob Two|Chris Three)$/).map((node) => node.props.children);
  expect(names).toEqual(['Alex One', 'Bob Two', 'Chris Three']);
});

test('lists the current players and the departures of the season', async () => {
  render(<SquadScreen teamId={TEAM_ID} origin="standings" />);

  await waitFor(() => expect(screen.getByText('David Benali')).toBeTruthy());
  expect(leagueService.getSquad).toHaveBeenCalledWith('l', SEASON.id, TEAM_ID, { all: true });
  expect(screen.getByText('US Bastille')).toBeTruthy();
  expect(screen.getByText(fr.squad.current(1))).toBeTruthy();
  expect(screen.getByText(fr.squad.departed(1))).toBeTruthy();
  expect(screen.getByText('Karim Sow')).toBeTruthy();
  expect(screen.getByText(fr.squad.leftOn('12 oct. 2026'))).toBeTruthy();
});

test('tapping a player opens the player screen in the same tab', async () => {
  render(<SquadScreen teamId={TEAM_ID} origin="following" />);
  await waitFor(() => expect(screen.getByText('Karim Sow')).toBeTruthy());

  fireEvent.press(screen.getByText('Karim Sow'));

  expect(mockPush).toHaveBeenCalledWith('/following/player/p2');
});

test('shows a message when the season has no player', async () => {
  jest.mocked(leagueService.getSquad).mockResolvedValue([]);
  render(<SquadScreen teamId={TEAM_ID} origin="standings" />);
  await waitFor(() => expect(screen.getByText(fr.squad.empty)).toBeTruthy());
});

test('shows the error state and retries', async () => {
  jest.mocked(leagueService.getSquad).mockRejectedValueOnce(new Error('network'));
  render(<SquadScreen teamId={TEAM_ID} origin="standings" />);
  await waitFor(() => expect(screen.getByText(fr.squad.error)).toBeTruthy());

  fireEvent.press(screen.getByText(fr.common.retry));

  await waitFor(() => expect(screen.getByText('David Benali')).toBeTruthy());
});
