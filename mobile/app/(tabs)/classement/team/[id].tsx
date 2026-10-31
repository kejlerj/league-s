import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TeamScreen } from '@/src/screens/TeamScreen';

export default function ClassementTeamRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TeamScreen id={id} />;
}
