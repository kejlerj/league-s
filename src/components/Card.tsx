import React from 'react';
import { View } from 'react-native';

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`bg-card dark:bg-cardDark border border-border dark:border-borderDark rounded-2xl overflow-hidden ${
        className ?? ''
      }`}
    >
      {children}
    </View>
  );
}

export function CardRow({
  children,
  isFirst = false,
  className,
  testID,
}: {
  children: React.ReactNode;
  isFirst?: boolean;
  className?: string;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      className={`flex-row items-center gap-3 px-4 py-3 ${
        isFirst ? '' : 'border-t border-hairline dark:border-hairlineDark'
      } ${className ?? ''}`}
    >
      {children}
    </View>
  );
}
