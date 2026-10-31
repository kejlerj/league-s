import React from 'react';
import { Stack } from 'expo-router';

export default function FollowingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="team/[id]" />
      <Stack.Screen name="squad/[teamId]" />
      <Stack.Screen name="player/[id]" />
    </Stack>
  );
}
