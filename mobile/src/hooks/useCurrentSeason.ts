import { useAsync } from './useAsync';
import { useLeagueId } from './useLeagueId';
import { pickCurrentSeason } from '@/src/logic/season';
import { listSeasons } from '@/src/services/league';

export function useCurrentSeason() {
  const leagueId = useLeagueId();
  const seasons = useAsync(() => listSeasons(leagueId), [leagueId]);
  const season = seasons.data ? pickCurrentSeason(seasons.data, new Date()) ?? null : null;
  return { season, loading: seasons.loading, error: seasons.error, reload: seasons.reload };
}
