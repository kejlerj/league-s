import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TabBar } from './TabBar';
import { fr } from '../i18n/fr';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const ROUTES = ['following', 'standings', 'predictions/index', 'profile/index'].map((name) => ({ key: `${name}-key`, name }));

function renderTabBar(navigate = jest.fn()) {
  const props = { state: { index: 0, routes: ROUTES }, navigation: { navigate } } as unknown as React.ComponentProps<typeof TabBar>;
  render(<TabBar {...props} />);
  return navigate;
}

test('every tab shows its French label, including the tabs without their own stack', () => {
  renderTabBar();
  expect(screen.getByText(fr.tabs.following)).toBeTruthy();
  expect(screen.getByText(fr.tabs.standings)).toBeTruthy();
  expect(screen.getByText(fr.tabs.predictions)).toBeTruthy();
  expect(screen.getByText(fr.tabs.profile)).toBeTruthy();
  expect(screen.queryByText('profile/index')).toBeNull();
  expect(screen.queryByText('predictions/index')).toBeNull();
});

test('tapping a tab navigates to its route', () => {
  const navigate = renderTabBar();
  fireEvent.press(screen.getByTestId('tab-profile'));
  expect(navigate).toHaveBeenCalledWith('profile/index');
});
