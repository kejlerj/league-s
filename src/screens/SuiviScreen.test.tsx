import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SuiviScreen } from './SuiviScreen';
import * as matchesService from '../services/matches';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { FixtureRow, FixtureSlotTone } from '../types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function fixtureRow(id: string, tone: FixtureSlotTone = 'score'): FixtureRow {
  return {
    matchId: id,
    when: 'Dim. 14',
    match: `Match ${id}`,
    sub: 'J4 · domicile · 15:00',
    slot: { text: tone === 'score' ? '3–1' : 'en cours', tone },
    target: { kind: 'match', id },
  };
}

beforeEach(() => {
  mockPush.mockClear();
  useAppStore.setState({
    follows: { 'fc-vallonnais': { notifyLevel: 'full' } },
    mvpVotes: {},
    themeMode: 'system',
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders a shop-suggestion row after the 5th fixture', async () => {
  const rows = Array.from({ length: 6 }, (_, i) => fixtureRow(`m${i + 1}`));
  jest.spyOn(matchesService, 'getMyFixtures').mockResolvedValue(rows);

  render(<SuiviScreen />);

  await waitFor(() => expect(screen.getByText('Match m6')).toBeTruthy());
  expect(screen.getByText('Boutique de la ligue · floquage offert')).toBeTruthy();
});

test('tapping a played fixture row navigates to its match page', async () => {
  jest.spyOn(matchesService, 'getMyFixtures').mockResolvedValue([fixtureRow('m1')]);

  render(<SuiviScreen />);

  await waitFor(() => expect(screen.getByText('Match m1')).toBeTruthy());
  fireEvent.press(screen.getByText('Match m1'));
  expect(mockPush).toHaveBeenCalledWith('/match/m1');
});

test('shows an error state on failure and retries the fetch on tapping retry', async () => {
  const getMyFixtures = jest
    .spyOn(matchesService, 'getMyFixtures')
    .mockRejectedValueOnce(new Error('network down'))
    .mockResolvedValueOnce([fixtureRow('m1')]);

  render(<SuiviScreen />);

  await waitFor(() => expect(screen.getByText(fr.suivi.error)).toBeTruthy());
  expect(getMyFixtures).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByText(fr.common.retry));

  await waitFor(() => expect(screen.getByText('Match m1')).toBeTruthy());
  expect(getMyFixtures).toHaveBeenCalledTimes(2);
});

test('shows the empty state when zero teams are followed', async () => {
  useAppStore.setState({ follows: {}, mvpVotes: {}, themeMode: 'system' });
  jest.spyOn(matchesService, 'getMyFixtures').mockResolvedValue([]);

  render(<SuiviScreen />);

  await waitFor(() => expect(screen.getByText(fr.suivi.empty)).toBeTruthy());
  expect(screen.getByText(fr.suivi.emptyHint)).toBeTruthy();
});
