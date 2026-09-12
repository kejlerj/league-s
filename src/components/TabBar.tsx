import React from 'react';
import { Pressable, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ThemedText } from './ThemedText';
import { fr } from '../i18n/fr';

const LABELS: Record<string, string> = {
  suivi: fr.tabs.suivi,
  classement: fr.tabs.classement,
  pronos: fr.tabs.pronos,
  moi: fr.tabs.moi,
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View className="flex-row bg-header dark:bg-headerDark border-t border-hairline dark:border-hairlineDark px-2 pt-2.5 pb-7">
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
