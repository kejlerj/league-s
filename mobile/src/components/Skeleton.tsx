import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

export function Skeleton({ rows = 4 }: { rows?: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View className="gap-3 px-5 py-4" testID="skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <Animated.View
          key={i}
          style={{ opacity, height: 52 }}
          className="rounded-2xl bg-field dark:bg-fieldDark"
        />
      ))}
    </View>
  );
}
