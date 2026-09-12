import React from 'react';
import { View } from 'react-native';

export function Avatar({ size = 32, rounded = 'full' }: { size?: number; rounded?: 'full' | 'md' }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: rounded === 'full' ? size / 2 : 8 }}
      className="bg-field dark:bg-fieldDark border border-border dark:border-borderDark"
    />
  );
}

export function Crest({ size = 32 }: { size?: number }) {
  return <Avatar size={size} rounded="md" />;
}
