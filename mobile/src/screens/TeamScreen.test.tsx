import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';
import { TeamScreen } from './TeamScreen';
import * as leagueService from '../services/league';
import * as matchesService from '../services/matches';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { ApiMatch } from '../types';
import { season } from '../test/fixtures';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
}));
jest.mock('../services/league');
jest.mock('../services/matches');

const SEASON = season({ id: 'season-1', league_id: 'l', name: '2026-2027', start_on: '2026-08-29', end_on: '2027-05-30' });
const TEAM_ID = 'team-us';
const OLD_SEASON = season({ id: 'season-0', league_id: 'l', name: '2025-2026', start_on: '2025-08-30', end_on: '2026-05-31' });

const finished: ApiMatch = {
  id: 'm-finished', season_id: SEASON.id,
  home_team: { id: TEAM_ID, name: 'US Bastille', logo: null },
  away_team: { id: 'opp', name: 'AS Belleville', logo: null },
  matchday: 3, kickoff_at: '2026-09-20T18:00:00Z', status: 'finished',
  home_score: 2, away_score: 0, venue: null, referee: null, convocation_at: null, video_url: null,
};

const scheduled: ApiMatch = {
  ...finished, id: 'm-next', away_team: { id: 'next', name: 'Racing Oberkampf', logo: null },
  matchday: 7, kickoff_at: '2026-10-20T18:00:00Z', status: 'scheduled', home_score: null, away_score: null,
  venue: 'Le Five Paris 18', convocation_at: '2026-10-20T17:30:00Z',
};

beforeEach(() => {
  useAppStore.setState({ themeMode: 'system', leagueId: 'l', followsByLeague: {} });
  jest.mocked(leagueService.listSeasons).mockResolvedValue([SEASON]);
  jest.mocked(leagueService.listTeamSeasons).mockResolvedValue([SEASON, OLD_SEASON]);
  jest.mocked(leagueService.getTeam).mockResolvedValue({ id: TEAM_ID, league_id: 'l', name: 'US Bastille', logo: null });
  jest.mocked(leagueService.getStandings).mockResolvedValue([
    { rank: 2, team_id: TEAM_ID, team_name: 'US Bastille', team_logo: null, played: 5, won: 3, drawn: 1, lost: 1, goals_for: 9, goals_against: 5, goal_difference: 4, points: 10, fair_play_points: 0 },
  ]);
  jest.mocked(leagueService.getSquad).mockResolvedValue([
    { membership_id: 'x', player_id: 'p', firstname: 'David', lastname: 'Benali', icon: null, number: 4, joined_on: '2026-08-29', left_on: null, goals: 0, assists: 0 },
  ]);
  jest.mocked(matchesService.listMatches).mockImplementation(async (_leagueId, _seasonId, query) =>
    query?.status === 'finished' ? [finished] : [scheduled]
  );
});

test('shows the team header, next match, results and squad from the API', async () => {
  render(<TeamScreen id={TEAM_ID} origin="following" />);

  await waitFor(() => expect(screen.getByText('US Bastille')).toBeTruthy());
  expect(screen.getByText('2ᵉ · 10 pts')).toBeTruthy();
  expect(screen.getByText(/Racing Oberkampf/)).toBeTruthy();
  expect(screen.getByText('Le Five Paris 18')).toBeTruthy();
  expect(screen.getByText('David Benali')).toBeTruthy();
  expect(screen.getByText('2–0')).toBeTruthy();
});

test('follow toggles the button label and the store', async () => {
  render(<TeamScreen id={TEAM_ID} origin="following" />);
  await waitFor(() => expect(screen.getByText(fr.team.follow)).toBeTruthy());

  fireEvent.press(screen.getByText(fr.team.follow));

  expect(useAppStore.getState().isFollowing(TEAM_ID)).toBe(true);
  await waitFor(() => expect(screen.getByText(fr.team.following)).toBeTruthy());
});

test('Voir l\'effectif complet opens the full squad in the same tab', async () => {
  render(<TeamScreen id={TEAM_ID} origin="following" />);
  await waitFor(() => expect(screen.getByText(fr.team.fullSquad)).toBeTruthy());
  expect(within(screen.getByTestId('team-squad')).getByText(fr.team.fullSquad)).toBeTruthy();

  fireEvent.press(screen.getByText(fr.team.fullSquad));

  expect(mockPush).toHaveBeenCalledWith(`/following/squad/${TEAM_ID}`);
});

test('lists the seasons the team played, most recent first', async () => {
  render(<TeamScreen id={TEAM_ID} origin="following" />);
  await waitFor(() => expect(screen.getByText(fr.team.seasons)).toBeTruthy());

  expect(leagueService.listTeamSeasons).toHaveBeenCalledWith('l', TEAM_ID);
  const seasons = within(screen.getByTestId('team-seasons'));
  expect(seasons.getByText('2026-2027')).toBeTruthy();
  expect(seasons.getByText('2025-2026')).toBeTruthy();
});

test('opening a season shows its standings in the same tab', async () => {
  render(<TeamScreen id={TEAM_ID} origin="standings" />);
  await waitFor(() => expect(screen.getByText('2025-2026')).toBeTruthy());

  fireEvent.press(screen.getByText('2025-2026'));

  expect(mockPush).toHaveBeenCalledWith(`/standings/season/${OLD_SEASON.id}?team=${TEAM_ID}`);
});

test('a team with no season yet says so', async () => {
  jest.mocked(leagueService.listTeamSeasons).mockResolvedValue([]);
  render(<TeamScreen id={TEAM_ID} origin="following" />);
  await waitFor(() => expect(screen.getByText(fr.team.noSeasons)).toBeTruthy());
});

test('the seasons failing to load shows the error state', async () => {
  jest.mocked(leagueService.listTeamSeasons).mockRejectedValueOnce(new Error('network'));
  render(<TeamScreen id={TEAM_ID} origin="following" />);
  await waitFor(() => expect(screen.getByText(fr.team.error)).toBeTruthy());
});

test('the next match and the results show the opponent crest', async () => {
  render(<TeamScreen id={TEAM_ID} origin="following" />);

  await waitFor(() => expect(screen.getByText(/Racing Oberkampf/)).toBeTruthy());
  const initials = screen.getAllByTestId('crest-initial', { includeHiddenElements: true }).map((node) => node.props.children);
  expect(initials).toEqual(expect.arrayContaining(['R', 'A']));
});
