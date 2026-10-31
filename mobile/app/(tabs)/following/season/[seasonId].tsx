import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SeasonStandingsScreen } from '@/src/screens/SeasonStandingsScreen';

export default function FollowingSeasonRoute() {
  const { seasonId, team } = useLocalSearchParams<{ seasonId: string; team: string }>();
  return <SeasonStandingsScreen seasonId={seasonId} teamId={team} origin="following" />;
}
