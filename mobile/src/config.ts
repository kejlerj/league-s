import Constants from 'expo-constants';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

export function fixedLeagueId(): string | null {
  const leagueId = Constants.expoConfig?.extra?.leagueId;
  return typeof leagueId === 'string' ? leagueId : null;
}
