import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TeamScreen } from '@/src/screens/TeamScreen';

export default function FollowingTeamRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TeamScreen id={id} />;
}
