import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';
import { ThemedText } from './ThemedText';
import { fr } from '../i18n/fr';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const LABELS: Record<string, string> = {
  following: fr.tabs.following,
  standings: fr.tabs.standings,
  predictions: fr.tabs.predictions,
  profile: fr.tabs.profile,
};

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row bg-header dark:bg-headerDark border-t border-hairline dark:border-hairlineDark px-2 pt-2.5"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            onPress={() => navigation.navigate(route.name)}
            className="flex-1 items-center gap-1.5"
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
          >
            <View
              className={`w-5 h-5 rounded-md ${
                focused ? 'bg-accent dark:bg-accentDark' : 'bg-border dark:bg-borderDark'
              }`}
            />
            <ThemedText
              weight={focused ? 'semibold' : 'medium'}
              size={10}
              tone={focused ? 'accent' : 'muted'}
              className="uppercase tracking-wide"
            >
              {LABELS[route.name] ?? route.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
