import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '@/src/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="following" />
      <Tabs.Screen name="standings" />
      <Tabs.Screen name="predictions" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
