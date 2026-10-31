import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { useAppStore } from '../store/useAppStore';

export function useThemeSync() {
  const themeMode = useAppStore((s) => s.themeMode);

  useEffect(() => {
    Appearance.setColorScheme(themeMode === 'system' ? 'unspecified' : themeMode);
  }, [themeMode]);
}
