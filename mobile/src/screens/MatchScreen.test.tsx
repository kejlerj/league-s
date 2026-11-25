import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MatchScreen } from './MatchScreen';
import * as leagueService from '../services/league';
import * as matchesService from '../services/matches';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { ApiMatch, MatchEvent } from '../types';
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
  jest.clearAllMocks();
  useAppStore.setState({ leagueId: 'l' });
  jest.mocked(leagueService.listSeasons).mockResolvedValue([SEASON]);
  jest.mocked(matchesService.getMatch).mockResolvedValue(liveMatch);
  jest.mocked(matchesService.getMatchEvents).mockResolvedValue([]);
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

function matchEvent(fields: Partial<MatchEvent>): MatchEvent {
  return {
    id: 'e1', match_id: 'm-live', team_id: 'h', type: 'goal', minute: 37,
    player: { id: 'p1', firstname: 'Malik', lastname: 'Diarra' },
    assist_player: { id: 'p2', firstname: 'Léo', lastname: 'Dupont' },
    player_in: null, own_goal: false, penalty: false, note: null, sent_off: false,
    home_score: 1, away_score: 0,
    ...fields,
  };
}

test('FAITS DE MATCH lists the events with the running score', async () => {
  jest.mocked(matchesService.getMatchEvents).mockResolvedValue([matchEvent({})]);

  render(<MatchScreen id="m-live" />);

  await waitFor(() => expect(screen.getByText(fr.match.events)).toBeTruthy());
  expect(matchesService.getMatchEvents).toHaveBeenCalledWith('l', SEASON.id, 'm-live');
  expect(screen.getByText("37'")).toBeTruthy();
  expect(screen.getByText('Malik Diarra')).toBeTruthy();
  expect(screen.getByText('Passe de L. Dupont')).toBeTruthy();
  expect(screen.getByText('1–0')).toBeTruthy();
});

test('an injury row shows Blessure, never its note', async () => {
  jest.mocked(matchesService.getMatchEvents).mockResolvedValue([
    matchEvent({ type: 'injury', minute: 71, assist_player: null, note: 'Cheville', home_score: null, away_score: null }),
  ]);

  render(<MatchScreen id="m-live" />);

  await waitFor(() => expect(screen.getByText(fr.match.eventDetail.injury)).toBeTruthy());
  expect(screen.queryByText('Cheville')).toBeNull();
});

test('FAITS DE MATCH is hidden when the match has no event', async () => {
  render(<MatchScreen id="m-live" />);

  await waitFor(() => expect(matchesService.getMatchEvents).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText('S. Lambert')).toBeTruthy());
  expect(screen.queryByText(fr.match.events)).toBeNull();
});

test('FAITS DE MATCH shows a skeleton while the events load', async () => {
  jest.mocked(matchesService.getMatchEvents).mockReturnValue(new Promise(() => {}));

  render(<MatchScreen id="m-live" />);

  await waitFor(() => expect(screen.getByText('S. Lambert')).toBeTruthy());
  expect(screen.getByTestId('match-events-loading')).toBeTruthy();
});

test('an events error shows a retry that loads them again', async () => {
  jest.mocked(matchesService.getMatchEvents).mockRejectedValueOnce(new Error('boom')).mockResolvedValue([matchEvent({})]);

  render(<MatchScreen id="m-live" />);

  await waitFor(() => expect(screen.getByText(fr.match.eventsError)).toBeTruthy());
  expect(screen.getByText('S. Lambert')).toBeTruthy();
  fireEvent.press(screen.getByText(fr.common.retry));
  await waitFor(() => expect(screen.getByText('Malik Diarra')).toBeTruthy());
});

test('a scheduled match does not ask for events', async () => {
  jest.mocked(matchesService.getMatch).mockResolvedValue({ ...liveMatch, status: 'scheduled', home_score: null, away_score: null });

  render(<MatchScreen id="m-live" />);

  await waitFor(() => expect(screen.getByText(fr.match.upcoming)).toBeTruthy());
  expect(matchesService.getMatchEvents).not.toHaveBeenCalled();
  expect(screen.queryByText(fr.match.events)).toBeNull();
});
