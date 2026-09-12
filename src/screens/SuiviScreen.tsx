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
import { useAppStore } from '../store/useAppStore';
import { getMyFixtures } from '../services/matches';
import { injectShopRows } from '../logic/injectShopRows';
import { teams } from '../data/teams';
import { fr } from '../i18n/fr';
import type { FixtureTarget } from '../types';

export function SuiviScreen() {
  const router = useRouter();
  const followedTeamIds = useAppStore((s) => s.followedTeamIds());
  const { data: fixtures, loading, error, reload } = useAsync(
    () => getMyFixtures(followedTeamIds),
    [followedTeamIds.join(',')]
  );

  const followedNames = followedTeamIds
    .map((id) => teams.find((t) => t.id === id)?.name ?? id)
    .join(' · ')
    .toUpperCase();

  const items = fixtures ? injectShopRows(fixtures) : [];

  function goToFixture(target: FixtureTarget) {
    router.push(target.kind === 'match' ? `/match/${target.id}` : `/suivi/team/${target.id}`);
  }

  return (
    <Screen>
      <HeaderCard>
        <View className="flex-row items-end justify-between">
          <View>
            <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide">
              {followedNames || fr.suivi.calendarLabel.toUpperCase()}
            </ThemedText>
            <ThemedText weight="semibold" size={24} className="mt-1.5">{fr.suivi.title}</ThemedText>
          </View>
          <ThemedText tone="accent" weight="medium" size={12.5} onPress={() => router.push('/moi')}>
            {fr.suivi.manage}
          </ThemedText>
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-2.5 pb-6">
        {loading && <Skeleton rows={5} />}
        {error && <ErrorState message={fr.suivi.error} onRetry={reload} />}

        {fixtures && (
          <>
            <SectionLabel>{fr.suivi.calendarLabel}</SectionLabel>

            {items.length === 0 ? (
              <View className="py-6 gap-1">
                <ThemedText tone="muted" size={13.5}>{fr.suivi.empty}</ThemedText>
                <ThemedText tone="faint" size={12}>{fr.suivi.emptyHint}</ThemedText>
              </View>
            ) : (
              <Card>
                {items.map((item, index) =>
                  item.kind === 'fixture' ? (
                    <Pressable key={item.row.matchId} onPress={() => goToFixture(item.row.target)}>
                      <CardRow isFirst={index === 0}>
                        <View style={{ width: 52 }}>
                          <ThemedText tone="muted" weight="medium" size={11.5}>{item.row.when}</ThemedText>
                        </View>
                        <View className="flex-1">
                          <ThemedText weight="medium" size={14.5}>{item.row.match}</ThemedText>
                          <ThemedText tone="muted" size={11.5} className="mt-0.5">{item.row.sub}</ThemedText>
                        </View>
                        <SlotChip text={item.row.slot.text} tone={item.row.slot.tone} />
                      </CardRow>
                    </Pressable>
                  ) : (
                    <CardRow key={`shop-${index}`} isFirst={index === 0}>
                      <View style={{ width: 52, height: 40 }} className="rounded-lg bg-field dark:bg-fieldDark" />
                      <View className="flex-1">
                        <ThemedText weight="medium" size={13.5}>{fr.suivi.shopItemName}</ThemedText>
                        <ThemedText tone="muted" size={11.5} className="mt-0.5">{fr.suivi.shopItemNote}</ThemedText>
                      </View>
                      <ThemedText
                        tone="accent"
                        weight="semibold"
                        size={12.5}
                        onPress={() => router.push('/boutique')}
                      >
                        {fr.suivi.shopCta}
                      </ThemedText>
                    </CardRow>
                  )
                )}
              </Card>
            )}

            <ThemedText tone="muted" size={11.5} className="leading-5">
              {fr.suivi.footerNote}
            </ThemedText>
          </>
        )}
      </View>
    </Screen>
  );
}
