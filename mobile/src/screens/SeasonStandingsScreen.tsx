import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { BackLink } from '../components/BackLink';
import { ThemedText } from '../components/ThemedText';
import { StandingsTable } from '../components/StandingsTable';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useLeagueId } from '../hooks/useLeagueId';
import { getSeason, getStandings } from '../services/league';
import { fr } from '../i18n/fr';
import type { TabOrigin } from '../types';

interface SeasonStandingsScreenProps {
  seasonId: string;
  teamId: string;
  origin: TabOrigin;
}

export function SeasonStandingsScreen({ seasonId, teamId, origin }: SeasonStandingsScreenProps) {
  const router = useRouter();
  const leagueId = useLeagueId();
  const season = useAsync(() => getSeason(leagueId, seasonId), [leagueId, seasonId]);
  const standings = useAsync(() => getStandings(leagueId, seasonId), [leagueId, seasonId]);

  const loading = season.loading || standings.loading;
  const error = season.error ?? standings.error;

  function reload() {
    season.reload();
    standings.reload();
  }

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-3">
          <BackLink label={fr.seasonStandings.back} />
          {season.data && (
            <ThemedText weight="semibold" size={24}>{fr.seasonStandings.title(season.data.name)}</ThemedText>
          )}
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-3.5 pb-6">
        {loading && <Skeleton rows={8} />}
        {error && <ErrorState message={fr.seasonStandings.error} onRetry={reload} />}
        {!loading && !error && standings.data && standings.data.length === 0 && (
          <ThemedText tone="muted" size={13.5}>{fr.standings.empty}</ThemedText>
        )}
        {!error && standings.data && standings.data.length > 0 && (
          <StandingsTable
            rows={standings.data}
            highlightedTeamIds={[teamId]}
            onPressTeam={(id) => router.push(`/${origin}/team/${id}`)}
          />
        )}
      </View>
    </Screen>
  );
}
