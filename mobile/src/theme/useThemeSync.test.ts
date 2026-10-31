import { renderHook } from '@testing-library/react-native';
import { Appearance } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { useThemeSync } from './useThemeSync';

let setColorScheme: jest.SpyInstance;

beforeEach(() => {
  setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
});

afterEach(() => {
  setColorScheme.mockRestore();
});

test('system mode hands the color scheme back to the device', () => {
  useAppStore.setState({ themeMode: 'system' });
  renderHook(() => useThemeSync());
  expect(setColorScheme).toHaveBeenLastCalledWith('unspecified');
});

test('a chosen mode forces that color scheme', () => {
  useAppStore.setState({ themeMode: 'dark' });
  renderHook(() => useThemeSync());
  expect(setColorScheme).toHaveBeenLastCalledWith('dark');
});
