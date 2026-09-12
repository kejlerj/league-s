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
import { useAppStore } from '../store/useAppStore';
import { getMatch } from '../services/matches';
import { teams } from '../data/teams';
import { players } from '../data/players';
import { fr } from '../i18n/fr';

export function MatchScreen({ id }: { id: string }) {
  const { data: match, loading, error, reload } = useAsync(() => getMatch(id), [id]);
  const voted = useAppStore((s) => (match?.mvp ? s.hasVotedFor(match.id, match.mvp.playerId) : false));
  const toggleMvpVote = useAppStore((s) => s.toggleMvpVote);

  const homeTeam = match ? teams.find((t) => t.id === match.homeTeamId) : undefined;
  const awayTeam = match ? teams.find((t) => t.id === match.awayTeamId) : undefined;
  const mvpPlayer = match?.mvp ? players.find((p) => p.id === match.mvp!.playerId) : undefined;
  const voteCount = match?.mvp ? match.mvp.voteCount + (voted ? 1 : 0) : 0;

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <BackLink label={`Journée ${match?.matchday ?? ''}`} />
            <View className="bg-field dark:bg-fieldDark rounded-md px-2 py-1">
              <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide">
                {fr.match.done}
              </ThemedText>
            </View>
          </View>

          {match && (
            <>
              <View className="flex-row items-center gap-2">
                <View className="flex-1 items-center gap-2">
                  <Crest size={46} />
                  <ThemedText weight="medium" size={13.5} className="text-center">{homeTeam?.name}</ThemedText>
                </View>
                <View className="flex-row items-center gap-2.5">
                  <ThemedText mono weight="semibold" size={40}>{match.homeScore}</ThemedText>
                  <ThemedText tone="faint" size={26}>–</ThemedText>
                  <ThemedText mono weight="semibold" size={40} tone="muted">{match.awayScore}</ThemedText>
                </View>
                <View className="flex-1 items-center gap-2">
                  <Crest size={46} />
                  <ThemedText weight="medium" size={13.5} tone="muted" className="text-center">
                    {awayTeam?.name}
                  </ThemedText>
                </View>
              </View>
              <ThemedText tone="muted" size={12.5} className="text-center">
                {new Date(match.kickoff).toLocaleDateString('fr-FR')} · {match.venue}
                {match.spectators ? ` · ${match.spectators} spectateurs` : ''}
              </ThemedText>
            </>
          )}
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-5 pb-6">
        {loading && <Skeleton rows={4} />}
        {error && <ErrorState message={fr.match.error} onRetry={reload} />}

        {match && (
          <>
            {match.videoUrl && (
              <Pressable onPress={() => Linking.openURL(match.videoUrl!)}>
                <Card>
                  <View className="h-[186px] bg-field dark:bg-fieldDark items-center justify-center">
                    <ThemedText tone="faint" size={11.5}>
                      résumé vidéo · {match.videoDuration}
                    </ThemedText>
                  </View>
                  <CardRow>
                    <ThemedText weight="medium" size={13.5} className="flex-1">{fr.match.videoLabel}</ThemedText>
                    <ThemedText tone="accent" weight="semibold" size={12.5}>{fr.match.videoOpen}</ThemedText>
                  </CardRow>
                </Card>
              </Pressable>
            )}

            {match.events && match.events.length > 0 && (
              <View className="gap-2.5">
                <SectionLabel>{fr.match.events}</SectionLabel>
                <Card>
                  {match.events.map((e, i) => (
                    <CardRow key={i} isFirst={i === 0}>
                      <ThemedText mono weight="medium" size={13} tone="muted" style={{ width: 34 }}>
                        {e.minute}'
                      </ThemedText>
                      <View className="w-5 h-5 rounded-[5px] bg-accent dark:bg-accentDark" />
                      <View className="flex-1">
                        <ThemedText weight="medium" size={14.5}>{e.playerName}</ThemedText>
                        <ThemedText tone="muted" size={11.5} className="mt-0.5">{e.detail}</ThemedText>
                      </View>
                      <ThemedText tone="muted" weight="medium" size={12.5}>{e.score}</ThemedText>
                    </CardRow>
                  ))}
                </Card>
              </View>
            )}

            {match.mvp && mvpPlayer && (
              <Card>
                <View className="p-4 gap-3.5">
                  <View className="flex-row items-center justify-between">
                    <SectionLabel>{fr.match.mvpTitle}</SectionLabel>
                    <ThemedText tone="faint" size={11.5}>{fr.match.votes(voteCount)}</ThemedText>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Crest size={48} />
                    <View className="flex-1">
                      <ThemedText weight="semibold" size={16}>{mvpPlayer.name}</ThemedText>
                      <ThemedText tone="muted" size={12.5} className="mt-0.5">
                        {mvpPlayer.position} · {match.mvp.votePercent}% des voix
                      </ThemedText>
                    </View>
                  </View>
                  <View className="h-2 rounded bg-field dark:bg-fieldDark overflow-hidden">
                    <View style={{ width: `${match.mvp.votePercent}%` }} className="h-2 bg-accent dark:bg-accentDark" />
                  </View>
                  <Pressable
                    testID="mvp-vote-button"
                    onPress={() => toggleMvpVote(match.id, match.mvp!.playerId)}
                    className={`h-11 rounded-xl items-center justify-center ${
                      voted ? 'bg-accent dark:bg-accentDark' : 'border border-border dark:border-borderDark'
                    }`}
                  >
                    <ThemedText weight="semibold" size={14} style={voted ? { color: '#fff' } : undefined}>
                      {voted ? fr.match.votedCta : fr.match.voteCta}
                    </ThemedText>
                  </Pressable>
                </View>
              </Card>
            )}

            <View className="gap-2.5">
              <SectionLabel>{fr.match.info}</SectionLabel>
              <Card>
                {(
                  [
                    match.referee ? [fr.match.infoKeys.referee, match.referee] : null,
                    [fr.match.infoKeys.venue, match.venue],
                    match.spectators ? [fr.match.infoKeys.spectators, String(match.spectators)] : null,
                    [fr.match.infoKeys.kickoff, new Date(match.kickoff).toLocaleString('fr-FR')],
                  ].filter((entry): entry is [string, string] => entry !== null)
                ).map(([k, v], i) => (
                  <CardRow key={k} isFirst={i === 0}>
                    <ThemedText tone="muted" size={12.5} style={{ width: 104 }}>{k}</ThemedText>
                    <ThemedText weight="medium" size={13.5} className="flex-1">{v}</ThemedText>
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
