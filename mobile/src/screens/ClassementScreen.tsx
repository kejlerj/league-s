import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { Card, CardRow } from '../components/Card';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { ThemedText } from '../components/ThemedText';
import { Crest } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useAppStore } from '../store/useAppStore';
import { getStandings, listSeasons } from '../services/league';
import { pickCurrentSeason } from '../logic/season';
import { fr } from '../i18n/fr';

export function ClassementScreen() {
  const router = useRouter();
  const followedTeamIds = useAppStore((s) => s.followedTeamIds());
  const seasons = useAsync(listSeasons, []);
  const currentSeason = seasons.data ? pickCurrentSeason(seasons.data, new Date()) : undefined;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? currentSeason?.id ?? null;
  const standings = useAsync(
    () => (activeId ? getStandings(activeId) : Promise.resolve([])),
    [activeId]
  );

  const seasonList = seasons.data ?? [];
  const seasonIndex = seasonList.findIndex((season) => season.id === activeId);

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-3.5">
          <ThemedText weight="semibold" size={24}>{fr.classement.title}</ThemedText>
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
            message={fr.classement.error}
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
          <ThemedText tone="muted" size={13.5}>{fr.classement.empty}</ThemedText>
        )}

        {standings.data && standings.data.length > 0 && (
          <>
            <View className="flex-row items-center gap-3 px-1">
              <ThemedText tone="faint" mono size={10.5} style={{ width: 20 }}>{fr.classement.columnHeaders.rank}</ThemedText>
              <ThemedText tone="faint" mono size={10.5} className="flex-1">{fr.classement.columnHeaders.team}</ThemedText>
              <View style={{ width: 112 }} className="flex-row justify-between">
                <ThemedText tone="faint" mono size={10.5}>{fr.classement.columnHeaders.played}</ThemedText>
                <ThemedText tone="faint" mono size={10.5}>{fr.classement.columnHeaders.diff}</ThemedText>
                <ThemedText tone="faint" mono size={10.5}>{fr.classement.columnHeaders.pts}</ThemedText>
              </View>
            </View>
            <Card>
              {standings.data.map((row, index) => (
                <Pressable key={row.team_id} onPress={() => router.push(`/classement/team/${row.team_id}`)}>
                  <CardRow
                    isFirst={index === 0}
                    testID={`standings-row-${row.team_id}`}
                    className={followedTeamIds.includes(row.team_id) ? 'bg-accent/5 dark:bg-accentDark/10' : undefined}
                  >
                    <ThemedText mono weight="semibold" size={14} style={{ width: 20 }}>{row.rank}</ThemedText>
                    <Crest size={26} />
                    <ThemedText weight="medium" size={14.5} className="flex-1">{row.team_name}</ThemedText>
                    <View style={{ width: 112 }} className="flex-row justify-between">
                      <ThemedText tone="muted" weight="medium" size={13.5}>{row.played}</ThemedText>
                      <ThemedText tone="muted" weight="medium" size={13.5}>{row.goal_difference}</ThemedText>
                      <ThemedText weight="semibold" size={13.5}>{row.points}</ThemedText>
                    </View>
                  </CardRow>
                </Pressable>
              ))}
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}
