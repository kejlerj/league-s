import React from 'react';
import { View } from 'react-native';
import { ThemedText } from './ThemedText';
import type { ResultTag } from '../types';

const BG_CLASS: Record<ResultTag, string> = {
  V: 'bg-accent dark:bg-accentDark',
  N: 'bg-field dark:bg-fieldDark',
  D: 'bg-negBg dark:bg-negBgDark',
};

const TEXT_STYLE: Record<ResultTag, { color: string } | undefined> = {
  V: { color: '#fff' },
  N: undefined,
  D: undefined,
};

const TEXT_CLASS: Record<ResultTag, string | undefined> = {
  V: undefined,
  N: undefined,
  D: 'text-neg dark:text-negDark',
};

export function FormChips({ form }: { form: ResultTag[] }) {
  return (
    <View className="flex-row gap-1.5">
      {form.map((tag, i) => (
        <View
          key={i}
          className={`w-[22px] h-[22px] rounded-md items-center justify-center ${BG_CLASS[tag]}`}
        >
          <ThemedText weight="semibold" size={11.5} style={TEXT_STYLE[tag]} className={TEXT_CLASS[tag]}>
            {tag}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}
