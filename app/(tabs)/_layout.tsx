import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '@/src/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="suivi" />
      <Tabs.Screen name="classement" />
      <Tabs.Screen name="pronos" />
      <Tabs.Screen name="moi" />
    </Tabs>
  );
}
