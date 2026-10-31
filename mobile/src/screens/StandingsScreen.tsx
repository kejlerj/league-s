import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { ThemedText } from '../components/ThemedText';
import { StandingsTable } from '../components/StandingsTable';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useLeagueId } from '../hooks/useLeagueId';
import { useAppStore } from '../store/useAppStore';
import { getStandings, listSeasons } from '../services/league';
import { pickCurrentSeason } from '../logic/season';
import { fr } from '../i18n/fr';

export function StandingsScreen() {
  const router = useRouter();
  const followedTeamIds = useAppStore((s) => s.followedTeamIds());
  const leagueId = useLeagueId();
  const seasons = useAsync(() => listSeasons(leagueId), [leagueId]);
  const currentSeason = seasons.data ? pickCurrentSeason(seasons.data, new Date()) : undefined;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? currentSeason?.id ?? null;
  const standings = useAsync(
    () => (activeId ? getStandings(leagueId, activeId) : Promise.resolve([])),
    [leagueId, activeId]
  );

  const seasonList = seasons.data ?? [];
  const seasonIndex = seasonList.findIndex((season) => season.id === activeId);

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-3.5">
          <ThemedText weight="semibold" size={24}>{fr.standings.title}</ThemedText>
          {seasonList.length > 0 && (
            <SegmentedTabs
              options={seasonList.map((season) => season.name)}
              value={seasonIndex}
              onChange={(index) => setSelectedId(seasonList[index].id)}
            />
          )}
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-3.5 pb-6">
        {(seasons.loading || standings.loading) && <Skeleton rows={8} />}
        {(seasons.error || standings.error) && (
          <ErrorState
            message={fr.standings.error}
            onRetry={() => {
              seasons.reload();
              standings.reload();
            }}
          />
        )}
        {!seasons.loading && seasonList.length === 0 && !seasons.error && (
          <ThemedText tone="muted" size={13.5}>{fr.common.noSeason}</ThemedText>
        )}

        {standings.data && standings.data.length === 0 && !standings.loading && (
          <ThemedText tone="muted" size={13.5}>{fr.standings.empty}</ThemedText>
        )}

        {standings.data && standings.data.length > 0 && (
          <StandingsTable
            rows={standings.data}
            highlightedTeamIds={followedTeamIds}
            onPressTeam={(teamId) => router.push(`/standings/team/${teamId}`)}
          />
        )}
      </View>
    </Screen>
  );
}
