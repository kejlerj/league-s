import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { ThemedText } from './ThemedText';

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

export function initialOf(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('fr');
}

export function Crest({ size = 32, uri, name }: { size?: number; uri?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (uri && !failed) {
    return (
      <View
        style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden' }}
        className="bg-field dark:bg-fieldDark border border-border dark:border-borderDark"
      >
        <Image testID="crest-image" source={{ uri }} style={{ width: size, height: size }} onError={() => setFailed(true)} />
      </View>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center bg-field dark:bg-fieldDark border border-border dark:border-borderDark"
    >
      <ThemedText testID="crest-initial" tone="muted" weight="semibold" size={Math.round(size * 0.45)}>
        {initialOf(name)}
      </ThemedText>
    </View>
  );
}
