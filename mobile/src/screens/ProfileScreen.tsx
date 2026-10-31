import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { ThemedText } from '../components/ThemedText';
import { useAsync } from '../hooks/useAsync';
import { useLeagueId } from '../hooks/useLeagueId';
import { useAppStore, type ThemeMode } from '../store/useAppStore';
import { getLeague } from '../services/league';
import { fr } from '../i18n/fr';

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function ProfileScreen() {
  const router = useRouter();
  const leagueId = useLeagueId();
  const league = useAsync(() => getLeague(leagueId), [leagueId]);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const followedCount = useAppStore((s) => s.followedTeamIds().length);

  return (
    <Screen>
      <HeaderCard>
        <ThemedText weight="semibold" size={24}>{fr.profile.title}</ThemedText>
      </HeaderCard>

      <View className="px-5 pt-4 gap-4 pb-6">
        <View className="gap-2.5">
          <SectionLabel>{fr.profile.league}</SectionLabel>
          <Card>
            <CardRow isFirst>
              <ThemedText
                tone={league.error ? 'muted' : 'primary'}
                weight="medium"
                size={14.5}
                className="flex-1"
              >
                {league.error ? fr.profile.leagueError : league.data?.name ?? ''}
              </ThemedText>
              <ThemedText tone="accent" weight="medium" size={12.5} onPress={() => router.push('/leagues')}>
                {fr.profile.changeLeague}
              </ThemedText>
            </CardRow>
          </Card>
        </View>

        <Card>
          <View className="p-3.5">
            <ThemedText mono weight="semibold" size={20}>{followedCount}</ThemedText>
            <ThemedText tone="muted" weight="medium" size={11} className="mt-1.5 uppercase tracking-wide">
              {fr.profile.followedStat}
            </ThemedText>
            <ThemedText tone="faint" size={12} className="mt-2">{fr.profile.followsHint}</ThemedText>
          </View>
        </Card>

        <View className="gap-2.5">
          <SectionLabel>{fr.profile.theme}</SectionLabel>
          <Card>
            <CardRow isFirst>
              <SegmentedTabs
                options={fr.profile.themeOptions}
                value={THEME_MODES.indexOf(themeMode)}
                onChange={(index) => setThemeMode(THEME_MODES[index])}
              />
            </CardRow>
          </Card>
        </View>
      </View>
    </Screen>
  );
}
