import '../global.css';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import {
  useFonts,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import * as SplashScreen from 'expo-splash-screen';
import { useThemeSync } from '@/src/theme/useThemeSync';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useThemeSync();
  const [fontsLoaded] = useFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="leagues" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="match/[id]" />
    </Stack>
  );
}
