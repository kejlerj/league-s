import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { MatchScreen } from '@/src/screens/MatchScreen';
import { RequireLeague } from '@/src/components/RequireLeague';

export default function MatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequireLeague>
      <MatchScreen id={id} />
    </RequireLeague>
  );
}
