import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TeamScreen } from './TeamScreen';
import * as leagueService from '../services/league';
import * as matchesService from '../services/matches';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { ApiMatch } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock('../services/league');
jest.mock('../services/matches');

const SEASON = { id: 'season-1', league_id: 'l', name: '2026-2027', start_on: '2026-08-29', end_on: '2027-05-30' };
const TEAM_ID = 'team-us';

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
  jest.mocked(leagueService.getTeam).mockResolvedValue({ id: TEAM_ID, league_id: 'l', name: 'US Bastille', logo: null });
  jest.mocked(leagueService.getStandings).mockResolvedValue([
    { rank: 2, team_id: TEAM_ID, team_name: 'US Bastille', played: 5, won: 3, drawn: 1, lost: 1, goals_for: 9, goals_against: 5, goal_difference: 4, points: 10 },
  ]);
  jest.mocked(leagueService.getSquad).mockResolvedValue([
    { membership_id: 'x', player_id: 'p', firstname: 'David', lastname: 'Benali', icon: null, number: 4, joined_on: '2026-08-29', left_on: null },
  ]);
  jest.mocked(matchesService.listMatches).mockImplementation(async (_leagueId, _seasonId, query) =>
    query?.status === 'finished' ? [finished] : [scheduled]
  );
});

test('shows the team header, next match, results and squad from the API', async () => {
  render(<TeamScreen id={TEAM_ID} />);

  await waitFor(() => expect(screen.getByText('US Bastille')).toBeTruthy());
  expect(screen.getByText('2ᵉ · 10 pts')).toBeTruthy();
  expect(screen.getByText(/Racing Oberkampf/)).toBeTruthy();
  expect(screen.getByText('Le Five Paris 18')).toBeTruthy();
  expect(screen.getByText('David Benali')).toBeTruthy();
  expect(screen.getByText('2–0')).toBeTruthy();
});

test('follow toggles the button label and the store', async () => {
  render(<TeamScreen id={TEAM_ID} />);
  await waitFor(() => expect(screen.getByText(fr.team.follow)).toBeTruthy());

  fireEvent.press(screen.getByText(fr.team.follow));

  expect(useAppStore.getState().isFollowing(TEAM_ID)).toBe(true);
  await waitFor(() => expect(screen.getByText(fr.team.following)).toBeTruthy());
});
