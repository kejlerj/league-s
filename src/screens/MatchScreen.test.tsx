import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { MatchScreen } from './MatchScreen';
import * as matchesService from '../services/matches';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { Match } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

const mockMatch: Match = {
  id: 'm-j3-vallonnais',
  matchday: 3,
  homeTeamId: 'fc-vallonnais',
  awayTeamId: 'etoile-de-mornay',
  kickoff: '2026-09-07T15:00:00Z',
  venue: 'Stade des Marnes, terrain 2',
  status: 'played',
  homeScore: 3,
  awayScore: 1,
  referee: 'L. Fabre',
  spectators: 140,
  videoUrl: 'https://example.com/video',
  videoDuration: '8:42',
  events: [
    { minute: 12, type: 'goal', playerName: 'Malik Diarra', detail: 'Passe de T. Rasolo', score: '1–0' },
  ],
  mvp: { playerId: 'fc-vallonnais-p4', votePercent: 61, voteCount: 214 },
};

beforeEach(() => {
  useAppStore.setState({ follows: {}, mvpVotes: {}, themeMode: 'system' });
  jest.spyOn(matchesService, 'getMatch').mockResolvedValue(mockMatch);
});

test('tapping the MVP vote button toggles the label and the vote count', async () => {
  render(<MatchScreen id="m-j3-vallonnais" />);

  await waitFor(() => expect(screen.getByText(fr.match.voteCta)).toBeTruthy());
  expect(screen.getByText(fr.match.votes(214))).toBeTruthy();

  fireEvent.press(screen.getByTestId('mvp-vote-button'));

  await waitFor(() => expect(screen.getByText(fr.match.votedCta)).toBeTruthy());
  expect(screen.getByText(fr.match.votes(215))).toBeTruthy();
});
