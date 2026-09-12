import React from 'react';
import { View } from 'react-native';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { ThemedText } from '../components/ThemedText';
import { Avatar } from '../components/Avatar';
import { useAppStore, type ThemeMode } from '../store/useAppStore';
import { profile } from '../data/profile';
import { fr } from '../i18n/fr';

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function MoiScreen() {
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const followedCount = useAppStore((s) => s.followedTeamIds().length);

  const accountRows = [
    { label: fr.moi.notifications, value: '' },
    { label: fr.moi.privacy, value: '' },
    { label: fr.moi.language, value: fr.moi.languageValue },
    { label: fr.moi.logout, value: '' },
  ];

  return (
    <Screen>
      <HeaderCard>
        <View className="flex-row items-center gap-3.5">
          <Avatar size={56} />
          <View className="flex-1">
            <ThemedText weight="semibold" size={20}>{profile.name}</ThemedText>
            <ThemedText tone="muted" size={12.5} className="mt-1">
              {fr.moi.since(profile.since)} · {profile.supporterOf}
            </ThemedText>
          </View>
          <ThemedText tone="accent" weight="medium" size={12.5}>{fr.moi.editCta}</ThemedText>
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-[18px] pb-6">
        <View className="flex-row gap-3">
          <Card className="flex-1">
            <View className="p-3.5">
              <ThemedText mono tone="accent" weight="semibold" size={20}>{profile.pronoPoints}</ThemedText>
              <ThemedText tone="muted" weight="medium" size={11} className="mt-1.5 uppercase tracking-wide">
                {fr.moi.pronoStat} · {profile.pronoRank}ᵉ
              </ThemedText>
            </View>
          </Card>
          <Card className="flex-1">
            <View className="p-3.5">
              <ThemedText mono weight="semibold" size={20}>{followedCount}</ThemedText>
              <ThemedText tone="muted" weight="medium" size={11} className="mt-1.5 uppercase tracking-wide">
                {fr.moi.teamsStat}
              </ThemedText>
            </View>
          </Card>
        </View>

        <View className="gap-2.5">
          <SectionLabel>{fr.moi.account}</SectionLabel>
          <Card>
            <CardRow isFirst>
              <ThemedText weight="medium" size={14.5} className="flex-1">{fr.moi.theme}</ThemedText>
              <View className="flex-1">
                <SegmentedTabs
                  options={fr.moi.themeOptions}
                  value={THEME_MODES.indexOf(themeMode)}
                  onChange={(index) => setThemeMode(THEME_MODES[index])}
                />
              </View>
            </CardRow>
            {accountRows.map((row) => (
              <CardRow key={row.label}>
                <ThemedText weight="medium" size={14.5} className="flex-1">{row.label}</ThemedText>
                {row.value ? <ThemedText tone="muted" size={12.5}>{row.value}</ThemedText> : null}
                <ThemedText tone="faint" size={15}>›</ThemedText>
              </CardRow>
            ))}
          </Card>
        </View>
      </View>
    </Screen>
  );
}
