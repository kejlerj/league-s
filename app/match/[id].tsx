import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/src/components/PlaceholderScreen';

export default function MatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title={`Match ${id}`} note="En construction." />;
}
