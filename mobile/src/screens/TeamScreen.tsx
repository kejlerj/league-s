import React from 'react';
import { Pressable, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { BackLink } from '../components/BackLink';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { ThemedText } from '../components/ThemedText';
import { FormChips } from '../components/FormChips';
import { Avatar, Crest } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useCurrentSeason } from '../hooks/useCurrentSeason';
import { useLeagueId } from '../hooks/useLeagueId';
import { useAppStore } from '../store/useAppStore';
import { getSquad, getStandings, getTeam, listTeamSeasons } from '../services/league';
import { listMatches } from '../services/matches';
import { buildTeamDetail } from '../logic/teamDetail';
import { formatDateTime, formatTime, toLocalDateParam } from '../logic/dateTime';
import { fr } from '../i18n/fr';
import type { TabOrigin } from '../types';

export function TeamScreen({ id, origin }: { id: string; origin: TabOrigin }) {
  const router = useRouter();
  const isFollowing = useAppStore((s) => s.isFollowing(id));
  const toggleFollow = useAppStore((s) => s.toggleFollow);
  const leagueId = useLeagueId();
  const team = useAsync(() => getTeam(leagueId, id), [leagueId, id]);
  const seasons = useAsync(() => listTeamSeasons(leagueId, id), [leagueId, id]);
  const season = useCurrentSeason();
  const detail = useAsync(async () => {
    if (!season.season) return null;
    const seasonId = season.season.id;
    const [finished, scheduled, squad, standings] = await Promise.all([
      listMatches(leagueId, seasonId, { team: id, status: 'finished' }),
      listMatches(leagueId, seasonId, { team: id, status: 'scheduled', from: toLocalDateParam(new Date()) }),
      getSquad(leagueId, seasonId, id),
      getStandings(leagueId, seasonId),
    ]);
    return buildTeamDetail({ teamId: id, standings, finished, scheduled, squad });
  }, [leagueId, season.season?.id, id]);

  const loading = team.loading || season.loading || detail.loading || seasons.loading;
  const error = team.error ?? season.error ?? detail.error ?? seasons.error;

  function reload() {
    team.reload();
    season.reload();
    detail.reload();
    seasons.reload();
  }

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-4">
          <BackLink label={fr.team.back} />

          {team.data && (
            <>
              <View className="flex-row items-center gap-3.5">
                <Crest size={56} uri={team.data.logo} />
                <View className="flex-1">
                  <ThemedText weight="semibold" size={24}>{team.data.name}</ThemedText>
                  {detail.data?.standing && (
                    <ThemedText tone="muted" size={13.5} className="mt-1">
                      {fr.team.rankLine(detail.data.standing.rank, detail.data.standing.points)}
                    </ThemedText>
                  )}
                </View>
              </View>

              <View className="flex-row items-center gap-2.5">
                <Pressable
                  onPress={() => toggleFollow(id)}
                  className={`h-10 px-4 rounded-xl items-center justify-center ${
                    isFollowing ? 'bg-accent dark:bg-accentDark' : 'border border-border dark:border-borderDark'
                  }`}
                >
                  <ThemedText weight="medium" size={14} style={isFollowing ? { color: '#fff' } : undefined}>
                    {isFollowing ? fr.team.following : fr.team.follow}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => Share.share({ message: team.data?.name ?? '' })}
                  className="h-10 px-4 rounded-xl border border-border dark:border-borderDark items-center justify-center"
                >
                  <ThemedText weight="medium" size={14}>{fr.team.share}</ThemedText>
                </Pressable>
              </View>

              <ThemedText tone="muted" size={12}>
                {isFollowing ? fr.team.followHintOn : fr.team.followHintOff}
              </ThemedText>

              {detail.data && detail.data.form.length > 0 && (
                <View className="flex-row items-center gap-1.5">
                  <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide mr-1">
                    {fr.team.form}
                  </ThemedText>
                  <FormChips form={detail.data.form} />
                </View>
              )}
            </>
          )}
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-5 pb-6">
        {loading && <Skeleton rows={4} />}
        {error && <ErrorState message={fr.team.error} onRetry={reload} />}

        {detail.data && (
          <>
            <View className="gap-2.5">
              <SectionLabel>{fr.team.nextMatch}</SectionLabel>
              <Card>
                {detail.data.nextMatch ? (
                  <View className="p-4 gap-2">
                    <ThemedText tone="accent" mono weight="semibold" size={12.5}>
                      {detail.data.nextMatch.kickoffAt ? formatDateTime(detail.data.nextMatch.kickoffAt) : fr.team.scheduleTbd}
                    </ThemedText>
                    <ThemedText weight="semibold" size={17}>
                      {detail.data.nextMatch.opponentName}{' '}
                      <ThemedText tone="muted" size={17}>
                        {detail.data.nextMatch.isHome ? fr.team.home : fr.team.away}
                      </ThemedText>
                    </ThemedText>
                    {detail.data.nextMatch.venue && (
                      <ThemedText tone="muted" size={12.5}>{detail.data.nextMatch.venue}</ThemedText>
                    )}
                    {detail.data.nextMatch.convocationAt && (
                      <ThemedText tone="muted" size={12.5}>
                        {fr.team.convocation(formatTime(detail.data.nextMatch.convocationAt))}
                      </ThemedText>
                    )}
                  </View>
                ) : (
                  <ThemedText tone="muted" size={13.5} className="p-4">{fr.team.noNextMatch}</ThemedText>
                )}
              </Card>
            </View>

            <View className="gap-2.5">
              <SectionLabel>{fr.team.lastResults}</SectionLabel>
              <Card>
                {detail.data.lastResults.length === 0 ? (
                  <ThemedText tone="muted" size={13.5} className="p-4">{fr.team.noResults}</ThemedText>
                ) : (
                  detail.data.lastResults.map((line, index) => (
                    <CardRow key={line.matchId} isFirst={index === 0}>
                      <ThemedText weight="semibold" size={11} className="w-5">{line.result}</ThemedText>
                      <ThemedText weight="medium" size={14.5} className="flex-1">
                        {line.opponentName}{' '}
                        <ThemedText tone="muted" size={14.5}>{line.isHome ? fr.team.home : fr.team.away}</ThemedText>
                      </ThemedText>
                      <ThemedText mono weight="semibold" size={15}>{line.score}</ThemedText>
                    </CardRow>
                  ))
                )}
              </Card>
            </View>

            <View className="gap-2.5" testID="team-squad">
              <SectionLabel>{fr.team.squad(detail.data.squad.length)}</SectionLabel>
              <Card>
                {detail.data.squad.length === 0 ? (
                  <ThemedText tone="muted" size={13.5} className="p-4">{fr.team.noSquad}</ThemedText>
                ) : (
                  detail.data.squad.map((player, index) => (
                    <CardRow key={player.membership_id} isFirst={index === 0}>
                      <ThemedText mono weight="semibold" size={14} tone="faint" style={{ width: 30 }}>
                        {player.number}
                      </ThemedText>
                      <Avatar size={32} uri={player.icon} />
                      <ThemedText weight="medium" size={14.5} className="flex-1">
                        {player.firstname} {player.lastname}
                      </ThemedText>
                    </CardRow>
                  ))
                )}
                <Pressable onPress={() => router.push(`/${origin}/squad/${id}`)} accessibilityRole="button">
                  <CardRow isFirst={false}>
                    <ThemedText tone="accent" weight="medium" size={13.5} className="flex-1">
                      {fr.team.fullSquad}
                    </ThemedText>
                    <ThemedText tone="accent" size={13.5}>›</ThemedText>
                  </CardRow>
                </Pressable>
              </Card>
            </View>

            {seasons.data && (
              <View className="gap-2.5" testID="team-seasons">
                <SectionLabel>{fr.team.seasons}</SectionLabel>
                <Card>
                  {seasons.data.length === 0 ? (
                    <ThemedText tone="muted" size={13.5} className="p-4">{fr.team.noSeasons}</ThemedText>
                  ) : (
                    seasons.data.map((teamSeason, index) => (
                      <Pressable
                        key={teamSeason.id}
                        onPress={() => router.push(`/${origin}/season/${teamSeason.id}?team=${id}`)}
                        accessibilityRole="button"
                      >
                        <CardRow isFirst={index === 0}>
                          <ThemedText weight="medium" size={14.5} className="flex-1">{teamSeason.name}</ThemedText>
                          <ThemedText tone="faint" size={13.5}>›</ThemedText>
                        </CardRow>
                      </Pressable>
                    ))
                  )}
                </Card>
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
