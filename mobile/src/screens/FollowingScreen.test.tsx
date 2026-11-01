import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { FollowingScreen } from './FollowingScreen';
import * as matchesService from '../services/matches';
import * as leagueService from '../services/league';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { ApiMatch } from '../types';
import { season } from '../test/fixtures';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../services/matches');
jest.mock('../services/league');

const SEASON = season({ id: 'season-1', league_id: 'l', name: '2026-2027', start_on: '2026-08-29', end_on: '2027-05-30' });
const TEAM = '01a10d58-8ae5-723e-b3d1-8d75cbe828bb';

function apiMatch(id: string, status: ApiMatch['status'], home: string, away: string): ApiMatch {
  return {
    id,
    season_id: SEASON.id,
    home_team: { id: 'home', name: home, logo: null },
    away_team: { id: 'away', name: away, logo: null },
    matchday: 4,
    kickoff_at: '2026-10-05T18:00:00Z',
    status,
    home_score: status === 'finished' ? 3 : null,
    away_score: status === 'finished' ? 1 : null,
    venue: null,
    referee: null,
    convocation_at: null,
    video_url: null,
  };
}

beforeEach(() => {
  mockPush.mockClear();
  jest.mocked(leagueService.listSeasons).mockResolvedValue([SEASON]);
  useAppStore.setState({ themeMode: 'system', leagueId: 'l', followsByLeague: { l: { [TEAM]: { notifyLevel: 'full' } } } });
});

test('lists the followed fixtures for the current season', async () => {
  jest.mocked(matchesService.getFollowedFixtures).mockResolvedValue([
    { match: apiMatch('m1', 'finished', 'Bastille', 'Belleville'), teamId: 'home' },
  ]);

  render(<FollowingScreen />);

  await waitFor(() => expect(screen.getByText('Bastille')).toBeTruthy());
  expect(screen.getByText('Belleville')).toBeTruthy();
  expect(matchesService.getFollowedFixtures).toHaveBeenCalledWith('l', SEASON.id, [TEAM]);
  expect(screen.getByText('3–1')).toBeTruthy();
});

test('tapping a finished fixture opens its match page', async () => {
  jest.mocked(matchesService.getFollowedFixtures).mockResolvedValue([
    { match: apiMatch('m1', 'finished', 'Bastille', 'Belleville'), teamId: 'home' },
  ]);

  render(<FollowingScreen />);
  await waitFor(() => expect(screen.getByText('Bastille')).toBeTruthy());
  fireEvent.press(screen.getByText('Bastille'));

  expect(mockPush).toHaveBeenCalledWith('/match/m1');
});

test('shows the empty state when no team is followed', async () => {
  useAppStore.setState({ followsByLeague: {} });
  jest.mocked(matchesService.getFollowedFixtures).mockResolvedValue([]);

  render(<FollowingScreen />);

  await waitFor(() => expect(screen.getByText(fr.following.empty)).toBeTruthy());
  expect(screen.getByText(fr.following.emptyHint)).toBeTruthy();
});

test('shows an error and retries on tap', async () => {
  jest.mocked(matchesService.getFollowedFixtures)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce([{ match: apiMatch('m1', 'finished', 'Bastille', 'Belleville'), teamId: 'home' }]);

  render(<FollowingScreen />);
  await waitFor(() => expect(screen.getByText(fr.following.error)).toBeTruthy());

  fireEvent.press(screen.getByText(fr.common.retry));

  await waitFor(() => expect(screen.getByText('Bastille')).toBeTruthy());
});

test('each team of a fixture shows its logo, or its initial without one', async () => {
  const match = apiMatch('m1', 'finished', 'Bastille', 'Belleville');
  jest.mocked(matchesService.getFollowedFixtures).mockResolvedValue([
    { match: { ...match, home_team: { ...match.home_team, logo: 'https://img.test/bastille.png' } }, teamId: 'home' },
  ]);

  render(<FollowingScreen />);

  await waitFor(() => expect(screen.getByText('Bastille')).toBeTruthy());
  expect(screen.getByTestId('crest-image').props.source).toEqual({ uri: 'https://img.test/bastille.png' });
  expect(screen.getByTestId('crest-initial', { includeHiddenElements: true })).toHaveTextContent('B');
});
