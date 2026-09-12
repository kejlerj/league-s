import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { MatchScreen } from '@/src/screens/MatchScreen';

export default function MatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MatchScreen id={id} />;
}
