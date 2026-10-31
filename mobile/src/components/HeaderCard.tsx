import React from 'react';
import { View } from 'react-native';

export function HeaderCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-header dark:bg-headerDark border-b border-hairline dark:border-hairlineDark px-5 pt-3 pb-3.5">
      {children}
    </View>
  );
}
