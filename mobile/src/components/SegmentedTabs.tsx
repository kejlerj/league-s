import React from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from './ThemedText';

export function SegmentedTabs({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <View className="flex-row gap-1.5 bg-field dark:bg-fieldDark p-1 rounded-xl">
      {options.map((label, index) => {
        const active = index === value;
        return (
          <Pressable
            key={label}
            testID={`segmented-tab-${label}`}
            onPress={() => onChange(index)}
            className={`flex-1 py-2 rounded-lg items-center ${active ? 'bg-accent dark:bg-accentDark' : ''}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <ThemedText
              weight="semibold"
              size={12.5}
              style={active ? { color: '#fff' } : undefined}
              className={active ? undefined : 'text-textMuted dark:text-textMutedDark'}
            >
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
