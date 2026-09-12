import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvasDark">
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}
