import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { MatchScreen } from './MatchScreen';
import * as leagueService from '../services/league';
import * as matchesService from '../services/matches';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { ApiMatch } from '../types';
import { season } from '../test/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));
jest.mock('../services/league');
jest.mock('../services/matches');

const SEASON = season({ id: 'season-1', league_id: 'l', name: '2026-2027', start_on: '2026-08-29', end_on: '2027-05-30' });

const liveMatch: ApiMatch = {
  id: 'm-live', season_id: SEASON.id,
  home_team: { id: 'h', name: 'US Bastille', logo: null },
  away_team: { id: 'a', name: 'AS Belleville', logo: null },
  matchday: 6, kickoff_at: '2026-10-05T18:09:28.963698Z', status: 'live',
  home_score: 1, away_score: 0, venue: 'Le Five Paris 18', referee: 'S. Lambert',
  convocation_at: '2026-10-05T17:30:00Z', video_url: null,
};

beforeEach(() => {
  useAppStore.setState({ leagueId: 'l' });
  jest.mocked(leagueService.listSeasons).mockResolvedValue([SEASON]);
  jest.mocked(matchesService.getMatch).mockResolvedValue(liveMatch);
});

test('shows the live match with its score, venue and referee', async () => {
  render(<MatchScreen id="m-live" />);

  await waitFor(() => expect(screen.getByText(fr.match.live)).toBeTruthy());
  expect(matchesService.getMatch).toHaveBeenCalledWith('l', SEASON.id, 'm-live');
  expect(screen.getByText('S. Lambert')).toBeTruthy();
  expect(screen.getAllByText(/Le Five Paris 18/).length).toBeGreaterThan(0);
});

test('a match without a score shows a dash and no fake result', async () => {
  jest.mocked(matchesService.getMatch).mockResolvedValue({
    ...liveMatch, status: 'scheduled', home_score: null, away_score: null, kickoff_at: null, convocation_at: null, referee: null, venue: null,
  });

  render(<MatchScreen id="m-live" />);

  await waitFor(() => expect(screen.getByText(fr.match.upcoming)).toBeTruthy());
  expect(screen.getAllByText(fr.match.scheduleTbd).length).toBeGreaterThan(0);
});
