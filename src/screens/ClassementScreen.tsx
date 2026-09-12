import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { ThemedText } from '../components/ThemedText';
import { Crest } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useAppStore } from '../store/useAppStore';
import { getStandings, getTopScorers, getTopAssists, getMvpRanking } from '../services/standings';
import { fr } from '../i18n/fr';
import type { PeopleRow } from '../types';

export function ClassementScreen() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const followedTeamIds = useAppStore((s) => s.followedTeamIds());

  const standings = useAsync(() => getStandings(followedTeamIds), [followedTeamIds.join(',')]);
  const scorers = useAsync(() => getTopScorers(), []);
  const assists = useAsync(() => getTopAssists(), []);
  const mvp = useAsync(() => getMvpRanking(), []);

  const peopleByTab: Record<number, ReturnType<typeof useAsync<PeopleRow[]>>> = {
    1: scorers,
    2: assists,
    3: mvp,
  };
  const peopleTitleByTab: Record<number, string> = {
    1: fr.classement.peopleTitle.scorers,
    2: fr.classement.peopleTitle.assists,
    3: fr.classement.peopleTitle.mvp,
  };
  const peopleFooterByTab: Record<number, string> = {
    1: fr.classement.peopleFooter.scorers,
    2: fr.classement.peopleFooter.assists,
    3: fr.classement.peopleFooter.mvp,
  };

  const current = tab === 0 ? standings : peopleByTab[tab];

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-3.5">
          <View>
            <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide">
              {fr.classement.overline}
            </ThemedText>
            <ThemedText weight="semibold" size={24} className="mt-1.5">{fr.classement.title}</ThemedText>
          </View>
          <SegmentedTabs options={fr.classement.tabs} value={tab} onChange={setTab} />
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-3.5 pb-6">
        {current.loading && <Skeleton rows={8} />}
        {current.error && <ErrorState message={fr.classement.error} onRetry={current.reload} />}

        {tab === 0 && standings.data && (
          <>
            <View className="flex-row items-center gap-3 px-1">
              <ThemedText tone="faint" mono size={10.5} style={{ width: 20 }}>
                {fr.classement.columnHeaders.rank}
              </ThemedText>
              <ThemedText tone="faint" mono size={10.5} className="flex-1">
                {fr.classement.columnHeaders.team}
              </ThemedText>
              <View style={{ width: 112 }} className="flex-row justify-between">
                <ThemedText tone="faint" mono size={10.5}>{fr.classement.columnHeaders.played}</ThemedText>
                <ThemedText tone="faint" mono size={10.5}>{fr.classement.columnHeaders.diff}</ThemedText>
                <ThemedText tone="faint" mono size={10.5}>{fr.classement.columnHeaders.pts}</ThemedText>
              </View>
            </View>
            <Card>
              {standings.data.map((row, i) => (
                <Pressable key={row.teamId} onPress={() => router.push(`/classement/team/${row.teamId}`)}>
                  <CardRow isFirst={i === 0}>
                    <ThemedText
                      mono
                      weight="semibold"
                      size={14}
                      style={{ width: 20 }}
                      className={
                        row.zone === 'promotion'
                          ? 'text-accent dark:text-accentDark'
                          : row.zone === 'playoff'
                          ? 'text-warn dark:text-warnDark'
                          : row.zone === 'relegation'
                          ? 'text-neg dark:text-negDark'
                          : undefined
                      }
                    >
                      {row.rank}
                    </ThemedText>
                    <Crest size={26} />
                    <ThemedText weight="medium" size={14.5} className="flex-1">{row.teamName}</ThemedText>
                    <View style={{ width: 112 }} className="flex-row justify-between">
                      <ThemedText tone="muted" weight="medium" size={13.5}>{row.played}</ThemedText>
                      <ThemedText tone="muted" weight="medium" size={13.5}>{row.goalDiff}</ThemedText>
                      <ThemedText weight="semibold" size={13.5}>{row.points}</ThemedText>
                    </View>
                  </CardRow>
                </Pressable>
              ))}
            </Card>
            <ThemedText tone="muted" size={11.5} className="px-1">{fr.classement.standingsFooter}</ThemedText>
          </>
        )}

        {tab > 0 && current.data && (
          <>
            <SectionLabel>{peopleTitleByTab[tab]}</SectionLabel>
            <Card>
              {(current.data as PeopleRow[]).map((row, i) => (
                <CardRow key={row.playerId} isFirst={i === 0}>
                  <ThemedText mono weight="semibold" size={14} tone="faint" style={{ width: 20 }}>
                    {row.rank}
                  </ThemedText>
                  <Crest size={34} />
                  <View className="flex-1">
                    <ThemedText weight="medium" size={14.5}>{row.name}</ThemedText>
                    <ThemedText tone="muted" size={11.5} className="mt-0.5">{row.teamName}</ThemedText>
                  </View>
                  <View className="items-end">
                    <ThemedText mono weight="semibold" size={17}>{row.value}</ThemedText>
                    <ThemedText tone="faint" mono size={10.5} className="mt-0.5">{row.unit}</ThemedText>
                  </View>
                </CardRow>
              ))}
            </Card>
            <ThemedText tone="muted" size={11.5} className="px-1">{peopleFooterByTab[tab]}</ThemedText>
          </>
        )}
      </View>
    </Screen>
  );
}
