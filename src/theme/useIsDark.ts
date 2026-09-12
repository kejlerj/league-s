import { useColorScheme } from 'react-native';

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
