import React from 'react';
import { View } from 'react-native';
import { ThemedText } from './ThemedText';

export function OddsBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  const segments = [
    { key: 'home', value: home },
    { key: 'draw', value: draw },
    { key: 'away', value: away },
  ];
  const max = Math.max(home, draw, away);

  return (
    <View className="flex-row gap-1.5">
      {segments.map((s) => {
        const isMax = s.value === max;
        return (
          <View
            key={s.key}
            testID={`odds-${s.key}`}
            style={{ flex: s.value }}
            className={`h-[30px] rounded-lg items-center justify-center ${
              isMax ? 'bg-accent dark:bg-accentDark' : 'bg-field dark:bg-fieldDark'
            }`}
          >
            <ThemedText
              mono
              weight={isMax ? 'semibold' : 'medium'}
              size={12}
              style={isMax ? { color: '#fff' } : undefined}
              className={isMax ? undefined : 'text-textMuted dark:text-textMutedDark'}
            >
              {s.value} %
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}
