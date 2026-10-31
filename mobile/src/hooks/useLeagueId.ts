import { useAppStore } from '@/src/store/useAppStore';

export function useLeagueId(): string {
  const leagueId = useAppStore((s) => s.leagueId);
  if (!leagueId) throw new Error('useLeagueId is used outside RequireLeague');
  return leagueId;
}
