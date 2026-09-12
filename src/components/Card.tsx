import React from 'react';
import { View } from 'react-native';

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-card dark:bg-cardDark border border-border dark:border-borderDark rounded-2xl overflow-hidden">
      {children}
    </View>
  );
}

export function CardRow({
  children,
  isFirst = false,
}: {
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3 ${
        isFirst ? '' : 'border-t border-hairline dark:border-hairlineDark'
      }`}
    >
      {children}
    </View>
  );
}
