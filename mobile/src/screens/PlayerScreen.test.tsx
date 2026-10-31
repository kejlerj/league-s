import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PlayerScreen } from './PlayerScreen';
import * as leagueService from '../services/league';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { CareerEntry, PlayerDetail } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('../services/league');

const PLAYER: PlayerDetail = {
  id: 'p1', league_id: 'l', firstname: 'David', lastname: 'Benali', icon: null,
  current_team: { id: 'team-us', name: 'US Bastille', logo: null },
};

const CAREER: CareerEntry[] = [
  {
    membership_id: 'm2', season: { id: 's2', name: '2026-2027' }, team: { id: 'team-us', name: 'US Bastille', logo: null },
    number: 4, joined_on: '2026-08-29', left_on: null,
  },
  {
    membership_id: 'm1', season: { id: 's1', name: '2025-2026' }, team: { id: 'team-as', name: 'AS Belleville', logo: null },
    number: 10, joined_on: '2025-08-30', left_on: '2026-05-31',
  },
];

beforeEach(() => {
  useAppStore.setState({ leagueId: 'l' });
  jest.mocked(leagueService.getPlayer).mockResolvedValue(PLAYER);
  jest.mocked(leagueService.getPlayerCareer).mockResolvedValue(CAREER);
});

test('shows a skeleton while loading', async () => {
  render(<PlayerScreen id="p1" />);
  expect(screen.getByTestId('skeleton')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('David Benali')).toBeTruthy());
});

test('shows the player, the current club and the career, most recent first', async () => {
  render(<PlayerScreen id="p1" />);

  await waitFor(() => expect(screen.getByText('David Benali')).toBeTruthy());
  expect(leagueService.getPlayer).toHaveBeenCalledWith('l', 'p1');
  expect(leagueService.getPlayerCareer).toHaveBeenCalledWith('l', 'p1');
  expect(screen.getByText(fr.player.currentClub('US Bastille'))).toBeTruthy();

  const seasons = screen.getAllByText(/^20\d\d-20\d\d$/).map((node) => node.props.children);
  expect(seasons).toEqual(['2026-2027', '2025-2026']);
  expect(screen.getByText(`AS Belleville · ${fr.player.number(10)}`)).toBeTruthy();
  expect(screen.getByText(fr.player.since('29 août 2026'))).toBeTruthy();
  expect(screen.getByText(fr.player.period('30 août 2025', '31 mai 2026'))).toBeTruthy();
});

test('a player in no squad shows no club', async () => {
  jest.mocked(leagueService.getPlayer).mockResolvedValue({ ...PLAYER, current_team: null });
  render(<PlayerScreen id="p1" />);
  await waitFor(() => expect(screen.getByText(fr.player.noClub)).toBeTruthy());
});

test('a player without any stint shows an empty career', async () => {
  jest.mocked(leagueService.getPlayerCareer).mockResolvedValue([]);
  render(<PlayerScreen id="p1" />);
  await waitFor(() => expect(screen.getByText(fr.player.noCareer)).toBeTruthy());
});

test('shows the error state and retries', async () => {
  jest.mocked(leagueService.getPlayerCareer).mockRejectedValueOnce(new Error('network'));
  render(<PlayerScreen id="p1" />);
  await waitFor(() => expect(screen.getByText(fr.player.error)).toBeTruthy());

  fireEvent.press(screen.getByText(fr.common.retry));

  await waitFor(() => expect(screen.getByText('David Benali')).toBeTruthy());
});
