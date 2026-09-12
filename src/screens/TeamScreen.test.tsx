import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TeamScreen } from './TeamScreen';
import * as teamsService from '../services/teams';
import { useAppStore } from '../store/useAppStore';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

const mockTeamDetail = {
  team: {
    id: 'fc-vallonnais',
    name: 'FC Vallonnais',
    shortName: 'Vallonnais',
    crestColor: '#000',
    rank: 2,
    points: 7,
    played: 3,
    goalDiff: 3,
    stadium: 'Stade des Marnes',
    form: ['V', 'V', 'N', 'D', 'V'] as const,
    squadCount: 18,
  },
  nextMatch: null,
  lastResults: [],
  squad: [],
};

beforeEach(() => {
  useAppStore.setState({ follows: {}, mvpVotes: {}, themeMode: 'system' });
  jest.spyOn(teamsService, 'getTeam').mockResolvedValue(mockTeamDetail);
});

test('toggling Follow updates the button label and the store', async () => {
  render(<TeamScreen id="fc-vallonnais" />);
  await waitFor(() => expect(screen.getByText('Suivre')).toBeTruthy());

  fireEvent.press(screen.getByText('Suivre'));

  expect(useAppStore.getState().isFollowing('fc-vallonnais')).toBe(true);
  await waitFor(() => expect(screen.getByText('Suivi ✓')).toBeTruthy());
});
