import React from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { fr } from '../i18n/fr';

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="items-center gap-3 px-5 py-10">
      <ThemedText tone="muted" size={13.5}>{message}</ThemedText>
      <Pressable
        onPress={onRetry}
        className="bg-accent dark:bg-accentDark rounded-xl px-4 py-2.5"
        accessibilityRole="button"
      >
        <ThemedText style={{ color: '#fff' }} weight="semibold" size={13.5}>
          {fr.common.retry}
        </ThemedText>
      </Pressable>
    </View>
  );
}
