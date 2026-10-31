import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '@/src/components/TabBar';
import { RequireLeague } from '@/src/components/RequireLeague';
import { useAppStore } from '@/src/store/useAppStore';

export default function TabsLayout() {
  const leagueId = useAppStore((s) => s.leagueId);
  return (
    <RequireLeague>
      <Tabs key={leagueId} tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="following" />
        <Tabs.Screen name="standings" />
        <Tabs.Screen name="predictions" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </RequireLeague>
  );
}
