import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from './ThemedText';

export function BackLink({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
      <ThemedText tone="muted" weight="medium" size={13.5}>
        {'‹ '}
        {label}
      </ThemedText>
    </Pressable>
  );
}
