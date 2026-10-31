import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { BackLink } from '../components/BackLink';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { ThemedText } from '../components/ThemedText';
import { Avatar } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useCurrentSeason } from '../hooks/useCurrentSeason';
import { useLeagueId } from '../hooks/useLeagueId';
import { getSquad, getTeam } from '../services/league';
import { formatCalendarDate } from '../logic/dateTime';
import { fr } from '../i18n/fr';
import type { SquadRow, TabOrigin } from '../types';

export function SquadScreen({ teamId, origin }: { teamId: string; origin: TabOrigin }) {
  const router = useRouter();
  const leagueId = useLeagueId();
  const team = useAsync(() => getTeam(leagueId, teamId), [leagueId, teamId]);
  const season = useCurrentSeason();
  const squad = useAsync(
    () => (season.season ? getSquad(leagueId, season.season.id, teamId, { all: true }) : Promise.resolve([])),
    [leagueId, season.season?.id, teamId]
  );

  const loading = team.loading || season.loading || squad.loading;
  const error = team.error ?? season.error ?? squad.error;
  const members = squad.data ?? [];
  const current = members.filter((member) => member.left_on === null);
  const departed = members.filter((member) => member.left_on !== null);

  function reload() {
    team.reload();
    season.reload();
    squad.reload();
  }

  function renderRows(rows: SquadRow[]) {
    return (
      <Card>
        {rows.map((member, index) => (
          <Pressable key={member.membership_id} onPress={() => router.push(`/${origin}/player/${member.player_id}`)}>
            <CardRow isFirst={index === 0}>
              <ThemedText mono weight="semibold" size={14} tone="faint" style={{ width: 30 }}>
                {member.number}
              </ThemedText>
              <Avatar size={32} uri={member.icon} />
              <View className="flex-1">
                <ThemedText weight="medium" size={14.5}>{`${member.firstname} ${member.lastname}`}</ThemedText>
                {member.left_on && (
                  <ThemedText tone="muted" size={12} className="mt-0.5">
                    {fr.squad.leftOn(formatCalendarDate(member.left_on))}
                  </ThemedText>
                )}
              </View>
            </CardRow>
          </Pressable>
        ))}
      </Card>
    );
  }

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-3">
          <BackLink label={fr.squad.back} />
          {team.data && <ThemedText weight="semibold" size={24}>{team.data.name}</ThemedText>}
          {season.season && <ThemedText tone="muted" size={13.5}>{season.season.name}</ThemedText>}
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-4 pb-6">
        {loading && <Skeleton rows={6} />}
        {error && <ErrorState message={fr.squad.error} onRetry={reload} />}

        {!loading && !error && members.length === 0 && (
          <ThemedText tone="muted" size={13.5}>{fr.squad.empty}</ThemedText>
        )}

        {!error && current.length > 0 && (
          <View className="gap-2.5">
            <SectionLabel>{fr.squad.current(current.length)}</SectionLabel>
            {renderRows(current)}
          </View>
        )}

        {!error && departed.length > 0 && (
          <View className="gap-2.5">
            <SectionLabel>{fr.squad.departed(departed.length)}</SectionLabel>
            {renderRows(departed)}
          </View>
        )}
      </View>
    </Screen>
  );
}
