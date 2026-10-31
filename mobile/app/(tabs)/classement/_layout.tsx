import React from 'react';
import { Stack } from 'expo-router';

export default function ClassementLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="team/[id]" />
    </Stack>
  );
}
