import React from 'react';
import { View } from 'react-native';
import { Screen } from './Screen';
import { ThemedText } from './ThemedText';

export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  return (
    <Screen scroll={false}>
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <View className="w-14 h-14 rounded-2xl bg-field dark:bg-fieldDark mb-2" />
        <ThemedText weight="semibold" size={20}>{title}</ThemedText>
        <ThemedText tone="muted" size={14}>Bientôt disponible</ThemedText>
        <ThemedText tone="faint" size={12.5} className="text-center mt-1">{note}</ThemedText>
      </View>
    </Screen>
  );
}
