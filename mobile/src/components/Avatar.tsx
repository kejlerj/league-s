import React from 'react';
import { Image, View } from 'react-native';

export function Avatar({ size = 32, rounded = 'full', uri }: { size?: number; rounded?: 'full' | 'md'; uri?: string | null }) {
  const radius = rounded === 'full' ? size / 2 : 8;
  return (
    <View
      style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }}
      className="bg-field dark:bg-fieldDark border border-border dark:border-borderDark"
    >
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} /> : null}
    </View>
  );
}

export function Crest({ size = 32, uri }: { size?: number; uri?: string | null }) {
  return <Avatar size={size} rounded="md" uri={uri} />;
}
