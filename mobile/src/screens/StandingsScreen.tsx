import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { ThemedText } from '../components/ThemedText';
import { StandingsTable } from '../components/StandingsTable';
import { RankingCard } from '../components/RankingCard';
import { SectionLabel } from '../components/SectionLabel';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useLeagueId } from '../hooks/useLeagueId';
import { useAppStore } from '../store/useAppStore';
import { getAssists, getScorers, getStandings, listSeasons } from '../services/league';
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

  const [tab, setTab] = useState(0);
  const ranking = useAsync(() => {
    if (!activeId || tab === 0) return Promise.resolve(null);
    return tab === 1 ? getScorers(leagueId, activeId) : getAssists(leagueId, activeId);
  }, [leagueId, activeId, tab]);
  const isScorers = tab === 1;

  const seasonList = seasons.data ?? [];
  const seasonIndex = seasonList.findIndex((season) => season.id === activeId);

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-3.5">
          <ThemedText weight="semibold" size={24}>{fr.standings.title}</ThemedText>
          <SegmentedTabs options={fr.standings.tabs} value={tab} onChange={setTab} />
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
        {(seasons.loading || (tab === 0 && standings.loading)) && <Skeleton rows={8} />}
        {(seasons.error || (tab === 0 && standings.error)) && (
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

        {tab === 0 && standings.data && standings.data.length === 0 && !standings.loading && (
          <ThemedText tone="muted" size={13.5}>{fr.standings.empty}</ThemedText>
        )}

        {tab === 0 && standings.data && standings.data.length > 0 && (
          <StandingsTable
            rows={standings.data}
            highlightedTeamIds={followedTeamIds}
            onPressTeam={(teamId) => router.push(`/standings/team/${teamId}`)}
          />
        )}

        {tab > 0 && activeId && ranking.loading && <Skeleton rows={8} />}
        {tab > 0 && ranking.error && <ErrorState message={fr.standings.rankingError} onRetry={ranking.reload} />}
        {tab > 0 && !ranking.loading && ranking.data && ranking.data.length === 0 && (
          <ThemedText tone="muted" size={13.5}>{isScorers ? fr.standings.noScorers : fr.standings.noAssists}</ThemedText>
        )}
        {tab > 0 && !ranking.loading && ranking.data && ranking.data.length > 0 && (
          <View className="gap-2.5">
            <SectionLabel>{isScorers ? fr.standings.scorersTitle : fr.standings.assistsTitle}</SectionLabel>
            <RankingCard
              rows={ranking.data}
              formatValue={isScorers ? fr.standings.goals : fr.standings.assists}
              onPressPlayer={(playerId) => router.push(`/standings/player/${playerId}`)}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}
