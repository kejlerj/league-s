import React from 'react';
import { View } from 'react-native';
import { ThemedText } from './ThemedText';
import type { FixtureSlotTone } from '../types';

const TONE_CLASS: Record<FixtureSlotTone, string> = {
  score: 'bg-field dark:bg-fieldDark',
  live: 'bg-warnBg dark:bg-warnBgDark',
  odds: 'bg-accent dark:bg-accentDark',
  date: 'bg-field dark:bg-fieldDark',
};

export function SlotChip({ text, tone }: { text: string; tone: FixtureSlotTone }) {
  return (
    <View
      className={`h-[26px] px-2.5 rounded-lg items-center justify-center ${TONE_CLASS[tone]}`}
    >
      <ThemedText
        mono
        weight="semibold"
        size={12.5}
        className={tone === 'live' ? 'text-warn dark:text-warnDark' : undefined}
        style={tone === 'odds' ? { color: '#fff' } : undefined}
      >
        {text}
      </ThemedText>
    </View>
  );
}
