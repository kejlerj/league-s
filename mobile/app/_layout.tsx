import '../global.css';
import React, { useEffect } from 'react';
import { Stack, useNavigationContainerRef } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import {
  useFonts,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import * as SplashScreen from 'expo-splash-screen';
import { useThemeSync } from '@/src/theme/useThemeSync';
import { initSentry, navigationIntegration } from '@/src/monitoring/sentry';

initSentry();
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  useThemeSync();
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

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

export default Sentry.wrap(RootLayout);
