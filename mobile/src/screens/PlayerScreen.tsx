import React from 'react';
import { View } from 'react-native';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { BackLink } from '../components/BackLink';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { ThemedText } from '../components/ThemedText';
import { Avatar, Crest } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useLeagueId } from '../hooks/useLeagueId';
import { getPlayer, getPlayerCareer } from '../services/league';
import { formatCalendarDate } from '../logic/dateTime';
import { fr } from '../i18n/fr';
import type { CareerEntry } from '../types';

function stintDates(entry: CareerEntry): string {
  const joined = formatCalendarDate(entry.joined_on);
  return entry.left_on ? fr.player.period(joined, formatCalendarDate(entry.left_on)) : fr.player.since(joined);
}

export function PlayerScreen({ id }: { id: string }) {
  const leagueId = useLeagueId();
  const player = useAsync(() => getPlayer(leagueId, id), [leagueId, id]);
  const career = useAsync(() => getPlayerCareer(leagueId, id), [leagueId, id]);

  const loading = player.loading || career.loading;
  const error = player.error ?? career.error;

  function reload() {
    player.reload();
    career.reload();
  }

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-4">
          <BackLink label={fr.player.back} />
          {player.data && (
            <View className="flex-row items-center gap-3.5">
              <Avatar size={56} uri={player.data.icon} />
              <View className="flex-1">
                <ThemedText weight="semibold" size={24}>{`${player.data.firstname} ${player.data.lastname}`}</ThemedText>
                <ThemedText tone="muted" size={13.5} className="mt-1">
                  {player.data.current_team ? fr.player.currentClub(player.data.current_team.name) : fr.player.noClub}
                </ThemedText>
              </View>
            </View>
          )}
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-4 pb-6">
        {loading && <Skeleton rows={4} />}
        {error && <ErrorState message={fr.player.error} onRetry={reload} />}

        {!loading && !error && career.data && (
          <View className="gap-2.5">
            <SectionLabel>{fr.player.career}</SectionLabel>
            <Card>
              {career.data.length === 0 ? (
                <ThemedText tone="muted" size={13.5} className="p-4">{fr.player.noCareer}</ThemedText>
              ) : (
                career.data.map((entry, index) => (
                  <CardRow key={entry.membership_id} isFirst={index === 0}>
                    <Crest size={26} uri={entry.team.logo} />
                    <View className="flex-1">
                      <ThemedText weight="medium" size={14.5}>{`${entry.team.name} · ${fr.player.number(entry.number)}`}</ThemedText>
                      <ThemedText tone="muted" size={12} className="mt-0.5">{stintDates(entry)}</ThemedText>
                    </View>
                    <ThemedText tone="faint" mono size={12}>{entry.season.name}</ThemedText>
                  </CardRow>
                ))
              )}
            </Card>
          </View>
        )}
      </View>
    </Screen>
  );
}
