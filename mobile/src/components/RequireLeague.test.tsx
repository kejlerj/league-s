import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { RequireLeague } from './RequireLeague';
import { useAppStore } from '../store/useAppStore';

jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return { Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText> };
});

test('without a chosen league it redirects to the league picker', async () => {
  useAppStore.setState({ leagueId: null });
  render(
    <RequireLeague>
      <Text>content</Text>
    </RequireLeague>
  );
  await waitFor(() => expect(screen.getByText('redirect:/leagues')).toBeTruthy());
  expect(screen.queryByText('content')).toBeNull();
});

test('with a chosen league it shows its content', async () => {
  useAppStore.setState({ leagueId: 'league-paris' });
  render(
    <RequireLeague>
      <Text>content</Text>
    </RequireLeague>
  );
  await waitFor(() => expect(screen.getByText('content')).toBeTruthy());
  expect(screen.queryByText('redirect:/leagues')).toBeNull();
});
