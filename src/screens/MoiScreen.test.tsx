import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MoiScreen } from './MoiScreen';
import { useAppStore } from '../store/useAppStore';

beforeEach(() => {
  useAppStore.setState({ themeMode: 'system', follows: { 'fc-vallonnais': { notifyLevel: 'full' } }, mvpVotes: {} });
});

test('renders the profile name and followed-team count', () => {
  render(<MoiScreen />);
  expect(screen.getByText('Julien Mercier')).toBeTruthy();
  expect(screen.getByText('1')).toBeTruthy();
});

test('tapping a theme segment updates the store', () => {
  render(<MoiScreen />);
  fireEvent.press(screen.getByTestId('segmented-tab-Sombre'));
  expect(useAppStore.getState().themeMode).toBe('dark');
});
