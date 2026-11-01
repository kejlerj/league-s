import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { BackLink } from '../components/BackLink';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { ThemedText } from '../components/ThemedText';
import { Crest } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useCurrentSeason } from '../hooks/useCurrentSeason';
import { useLeagueId } from '../hooks/useLeagueId';
import { getMatch } from '../services/matches';
import { statusOf } from '../logic/results';
import { isWebUrl } from '../logic/url';
import { formatDateTime, formatTime, parseApiDate } from '../logic/dateTime';
import { fr } from '../i18n/fr';
import type { MatchStatus } from '../types';

const STATUS_LABEL: Record<MatchStatus, string> = {
  upcoming: fr.match.upcoming,
  live: fr.match.live,
  played: fr.match.done,
  cancelled: fr.match.cancelled,
};

export function MatchScreen({ id }: { id: string }) {
  const leagueId = useLeagueId();
  const season = useCurrentSeason();
  const match = useAsync(
    () => (season.season ? getMatch(leagueId, season.season.id, id) : Promise.resolve(null)),
    [leagueId, season.season?.id, id]
  );

  const loading = season.loading || match.loading;
  const error = season.error ?? match.error;
  const data = match.data;
  const status = data ? statusOf(data) : null;
  const kickoff = data?.kickoff_at ? parseApiDate(data.kickoff_at) : null;
  const convocation = data?.convocation_at ? parseApiDate(data.convocation_at) : null;
  const videoUrl = data?.video_url ?? null;
  const hasScore = data !== null && data.home_score !== null && data.away_score !== null;

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <BackLink label={data ? fr.match.matchday(data.matchday) : ''} />
            {status && (
              <View className="bg-field dark:bg-fieldDark rounded-md px-2 py-1">
                <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide">
                  {STATUS_LABEL[status]}
                </ThemedText>
              </View>
            )}
          </View>

          {data && (
            <>
              <View className="flex-row items-center gap-2">
                <View className="flex-1 items-center gap-2">
                  <Crest size={46} uri={data.home_team.logo} name={data.home_team.name} />
                  <ThemedText weight="medium" size={13.5} className="text-center">{data.home_team.name}</ThemedText>
                </View>
                <View className="flex-row items-center gap-2.5">
                  {hasScore ? (
                    <>
                      <ThemedText mono weight="semibold" size={40}>{data.home_score}</ThemedText>
                      <ThemedText tone="faint" size={26}>–</ThemedText>
                      <ThemedText mono weight="semibold" size={40} tone="muted">{data.away_score}</ThemedText>
                    </>
                  ) : (
                    <ThemedText tone="faint" size={26}>–</ThemedText>
                  )}
                </View>
                <View className="flex-1 items-center gap-2">
                  <Crest size={46} uri={data.away_team.logo} name={data.away_team.name} />
                  <ThemedText weight="medium" size={13.5} tone="muted" className="text-center">{data.away_team.name}</ThemedText>
                </View>
              </View>
              <ThemedText tone="muted" size={12.5} className="text-center">
                {kickoff ? formatDateTime(kickoff) : fr.match.scheduleTbd}
                {data.venue ? ` · ${data.venue}` : ''}
              </ThemedText>
            </>
          )}
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-5 pb-6">
        {loading && <Skeleton rows={4} />}
        {error && <ErrorState message={fr.match.error} onRetry={() => { season.reload(); match.reload(); }} />}

        {data && (
          <>
            {isWebUrl(videoUrl) && (
              <Pressable onPress={() => Linking.openURL(videoUrl)}>
                <Card>
                  <CardRow isFirst>
                    <ThemedText weight="medium" size={13.5} className="flex-1">{fr.match.videoLabel}</ThemedText>
                    <ThemedText tone="accent" weight="semibold" size={12.5}>{fr.match.videoOpen}</ThemedText>
                  </CardRow>
                </Card>
              </Pressable>
            )}

            <View className="gap-2.5">
              <SectionLabel>{fr.match.info}</SectionLabel>
              <Card>
                {[
                  data.referee ? [fr.match.infoKeys.referee, data.referee] : null,
                  data.venue ? [fr.match.infoKeys.venue, data.venue] : null,
                  [fr.match.infoKeys.kickoff, kickoff ? formatDateTime(kickoff) : fr.match.scheduleTbd],
                  convocation ? [fr.match.infoKeys.convocation, formatTime(convocation)] : null,
                ]
                  .filter((entry): entry is string[] => entry !== null)
                  .map(([label, value], index) => (
                    <CardRow key={label} isFirst={index === 0}>
                      <ThemedText tone="muted" size={12.5} style={{ width: 104 }}>{label}</ThemedText>
                      <ThemedText weight="medium" size={13.5} className="flex-1">{value}</ThemedText>
                    </CardRow>
                  ))}
              </Card>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
