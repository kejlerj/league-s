import React from 'react';
import { Pressable, Share, View } from 'react-native';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { BackLink } from '../components/BackLink';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { ThemedText } from '../components/ThemedText';
import { FormChips } from '../components/FormChips';
import { OddsBar } from '../components/OddsBar';
import { Avatar, Crest } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useAppStore } from '../store/useAppStore';
import { getTeam } from '../services/teams';
import { fr } from '../i18n/fr';
import { formatShortDate } from '../logic/formatDate';

export function TeamScreen({ id }: { id: string }) {
  const isFollowing = useAppStore((s) => s.isFollowing(id));
  const toggleFollow = useAppStore((s) => s.toggleFollow);
  const { data, loading, error, reload } = useAsync(() => getTeam(id), [id]);

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <BackLink label={fr.team.back} />
            <View className="w-[26px] h-[26px] rounded-full bg-field dark:bg-fieldDark" />
          </View>

          {data && (
            <>
              <View className="flex-row items-center gap-3.5">
                <Crest size={56} />
                <View className="flex-1">
                  <ThemedText weight="semibold" size={24}>{data.team.name}</ThemedText>
                  <ThemedText tone="muted" size={13.5} className="mt-1">
                    {data.team.rank}ᵉ · {data.team.points} pts · {data.team.stadium}
                  </ThemedText>
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
                  onPress={() => Share.share({ message: data.team.name })}
                  className="h-10 px-4 rounded-xl border border-border dark:border-borderDark items-center justify-center"
                >
                  <ThemedText weight="medium" size={14}>{fr.team.share}</ThemedText>
                </Pressable>
              </View>

              <ThemedText tone="muted" size={12}>
                {isFollowing ? fr.team.followHintOn : fr.team.followHintOff}
              </ThemedText>

              <View className="flex-row items-center gap-1.5">
                <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide mr-1">
                  {fr.team.form}
                </ThemedText>
                <FormChips form={data.team.form} />
              </View>
            </>
          )}
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-5 pb-6">
        {loading && <Skeleton rows={4} />}
        {error && <ErrorState message={fr.team.error} onRetry={reload} />}

        {data && (
          <>
            {data.nextMatch && (
              <Card>
                <View className="p-4 gap-3">
                  <View className="flex-row items-center justify-between">
                    <SectionLabel>{fr.team.nextMatch}</SectionLabel>
                    <ThemedText tone="accent" mono weight="semibold" size={12.5}>
                      {formatShortDate(data.nextMatch.kickoff)}
                    </ThemedText>
                  </View>
                  <ThemedText weight="semibold" size={17}>
                    {data.nextMatch.opponentName}{' '}
                    <ThemedText tone="muted" size={17}>
                      — {data.nextMatch.venueTag === 'dom.' ? fr.team.home : fr.team.away}
                    </ThemedText>
                  </ThemedText>
                  {data.nextMatch.odds && <OddsBar {...data.nextMatch.odds} />}
                  <ThemedText tone="muted" size={12}>{fr.team.oddsNote}</ThemedText>
                </View>
              </Card>
            )}

            {data.lastResults.length > 0 && (
              <View className="gap-2.5">
                <SectionLabel>{fr.team.lastResults}</SectionLabel>
                <Card>
                  {data.lastResults.map((r, i) => (
                    <CardRow key={r.matchId} isFirst={i === 0}>
                      <View
                        className={`w-5 h-5 rounded-md items-center justify-center ${
                          r.result === 'V'
                            ? 'bg-accent dark:bg-accentDark'
                            : r.result === 'D'
                            ? 'bg-negBg dark:bg-negBgDark'
                            : 'bg-field dark:bg-fieldDark'
                        }`}
                      >
                        <ThemedText weight="semibold" size={11} style={r.result === 'V' ? { color: '#fff' } : undefined}>
                          {r.result}
                        </ThemedText>
                      </View>
                      <ThemedText weight="medium" size={14.5} className="flex-1">
                        {r.opponent} <ThemedText tone="muted" size={14.5}>{r.venueTag}</ThemedText>
                      </ThemedText>
                      <ThemedText mono weight="semibold" size={15}>{r.score}</ThemedText>
                    </CardRow>
                  ))}
                </Card>
              </View>
            )}

            {data.squad.length > 0 && (
              <View className="gap-2.5">
                <View className="flex-row items-baseline justify-between">
                  <SectionLabel>{fr.team.squad(data.team.squadCount)}</SectionLabel>
                  <ThemedText tone="faint" mono weight="medium" size={10.5}>{fr.team.squadLegend}</ThemedText>
                </View>
                <Card>
                  {data.squad.map((p, i) => (
                    <CardRow key={p.id} isFirst={i === 0}>
                      <ThemedText mono weight="semibold" size={14} tone="faint" style={{ width: 30 }}>
                        {p.number}
                      </ThemedText>
                      <Avatar size={32} />
                      <View className="flex-1">
                        <ThemedText weight="medium" size={14.5}>{p.name}</ThemedText>
                        <ThemedText tone="muted" size={11.5} className="mt-0.5">{p.position}</ThemedText>
                      </View>
                      <ThemedText tone="muted" weight="medium" size={13.5}>
                        {p.matchesPlayed} · {p.goals} · {p.assists}
                      </ThemedText>
                    </CardRow>
                  ))}
                  <CardRow>
                    <ThemedText tone="accent" weight="medium" size={13.5}>{fr.team.seeFullSquad}</ThemedText>
                  </CardRow>
                </Card>
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
