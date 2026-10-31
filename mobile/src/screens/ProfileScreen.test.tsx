import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ProfileScreen } from './ProfileScreen';
import { useAppStore } from '../store/useAppStore';

beforeEach(() => {
  useAppStore.setState({ themeMode: 'system', follows: { 'team-a': { notifyLevel: 'full' } } });
});

test('shows how many teams are followed on this device', () => {
  render(<ProfileScreen />);
  expect(screen.getByText('1')).toBeTruthy();
});

test('tapping Sombre updates the theme in the store', () => {
  render(<ProfileScreen />);
  fireEvent.press(screen.getByTestId('segmented-tab-Sombre'));
  expect(useAppStore.getState().themeMode).toBe('dark');
});
