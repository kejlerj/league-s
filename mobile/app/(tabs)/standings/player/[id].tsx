import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PlayerScreen } from '@/src/screens/PlayerScreen';

export default function StandingsPlayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlayerScreen id={id} />;
}
