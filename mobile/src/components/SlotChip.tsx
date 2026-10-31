import React from 'react';
import { View } from 'react-native';
import { ThemedText } from './ThemedText';
import type { SlotTone } from '@/src/logic/fixtureRow';

const TONE_CLASS: Record<SlotTone, string> = {
  score: 'bg-field dark:bg-fieldDark',
  live: 'bg-warnBg dark:bg-warnBgDark',
  date: 'bg-field dark:bg-fieldDark',
  muted: 'bg-field dark:bg-fieldDark',
};

export function SlotChip({ text, tone }: { text: string; tone: SlotTone }) {
  return (
    <View className={`h-[26px] px-2.5 rounded-lg items-center justify-center ${TONE_CLASS[tone]}`}>
      <ThemedText
        mono
        weight="semibold"
        size={12.5}
        tone={tone === 'muted' ? 'faint' : 'primary'}
        className={tone === 'live' ? 'text-warn dark:text-warnDark' : undefined}
      >
        {text}
      </ThemedText>
    </View>
  );
}
