import React from 'react';
import { View } from 'react-native';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { ThemedText } from '../components/ThemedText';
import { useAppStore, type ThemeMode } from '../store/useAppStore';
import { fr } from '../i18n/fr';

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function MoiScreen() {
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const followedCount = useAppStore((s) => s.followedTeamIds().length);

  return (
    <Screen>
      <HeaderCard>
        <ThemedText weight="semibold" size={24}>{fr.moi.title}</ThemedText>
      </HeaderCard>

      <View className="px-5 pt-4 gap-4 pb-6">
        <Card>
          <View className="p-3.5">
            <ThemedText mono weight="semibold" size={20}>{followedCount}</ThemedText>
            <ThemedText tone="muted" weight="medium" size={11} className="mt-1.5 uppercase tracking-wide">
              {fr.moi.followedStat}
            </ThemedText>
            <ThemedText tone="faint" size={12} className="mt-2">{fr.moi.followsHint}</ThemedText>
          </View>
        </Card>

        <View className="gap-2.5">
          <SectionLabel>{fr.moi.theme}</SectionLabel>
          <Card>
            <CardRow isFirst>
              <SegmentedTabs
                options={fr.moi.themeOptions}
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
