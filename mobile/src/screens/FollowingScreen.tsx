import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { SlotChip } from '../components/SlotChip';
import { ThemedText } from '../components/ThemedText';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useCurrentSeason } from '../hooks/useCurrentSeason';
import { useAppStore } from '../store/useAppStore';
import { getFollowedFixtures } from '../services/matches';
import { toFixtureRow } from '../logic/fixtureRow';
import { fr } from '../i18n/fr';

export function FollowingScreen() {
  const router = useRouter();
  const followedTeamIds = useAppStore((s) => s.followedTeamIds());
  const season = useCurrentSeason();
  const fixtures = useAsync(
    () => (season.season ? getFollowedFixtures(season.season.id, followedTeamIds) : Promise.resolve([])),
    [season.season?.id, followedTeamIds.join(',')]
  );

  const rows = (fixtures.data ?? []).map(({ match, teamId }) => toFixtureRow(match, teamId));
  const loading = season.loading || fixtures.loading;
  const error = season.error ?? fixtures.error;

  function reload() {
    season.reload();
    fixtures.reload();
  }

  return (
    <Screen>
      <HeaderCard>
        <View className="flex-row items-end justify-between">
          <View>
            <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide">
              {season.season ? `Saison ${season.season.name}` : fr.following.calendarLabel}
            </ThemedText>
            <ThemedText weight="semibold" size={24} className="mt-1.5">{fr.following.title}</ThemedText>
          </View>
          <ThemedText tone="accent" weight="medium" size={12.5} onPress={() => router.push('/profile')}>
            {fr.following.manage}
          </ThemedText>
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-2.5 pb-6">
        {loading && <Skeleton rows={5} />}
        {error && <ErrorState message={fr.following.error} onRetry={reload} />}

        {!loading && !error && (
          <>
            <SectionLabel>{fr.following.calendarLabel}</SectionLabel>

            {followedTeamIds.length === 0 ? (
              <View className="py-6 gap-1">
                <ThemedText tone="muted" size={13.5}>{fr.following.empty}</ThemedText>
                <ThemedText tone="faint" size={12}>{fr.following.emptyHint}</ThemedText>
              </View>
            ) : rows.length === 0 ? (
              <ThemedText tone="muted" size={13.5} className="py-6">{fr.following.noMatches}</ThemedText>
            ) : (
              <Card>
                {rows.map((row, index) => (
                  <Pressable
                    key={row.matchId}
                    onPress={() =>
                      router.push(
                        row.target.kind === 'match' ? `/match/${row.target.id}` : `/following/team/${row.target.id}`
                      )
                    }
                  >
                    <CardRow isFirst={index === 0}>
                      <View style={{ width: 52 }}>
                        <ThemedText tone="muted" weight="medium" size={11.5}>{row.when}</ThemedText>
                      </View>
                      <View className="flex-1">
                        <ThemedText weight="medium" size={14.5}>{row.title}</ThemedText>
                        <ThemedText tone="muted" size={11.5} className="mt-0.5">{row.sub}</ThemedText>
                      </View>
                      <SlotChip text={row.slot.text} tone={row.slot.tone} />
                    </CardRow>
                  </Pressable>
                ))}
              </Card>
            )}

            <ThemedText tone="muted" size={11.5} className="leading-5">{fr.following.footerNote}</ThemedText>
          </>
        )}
      </View>
    </Screen>
  );
}
