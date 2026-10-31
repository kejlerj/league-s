import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SquadScreen } from '@/src/screens/SquadScreen';

export default function FollowingSquadRoute() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  return <SquadScreen teamId={teamId} origin="following" />;
}
