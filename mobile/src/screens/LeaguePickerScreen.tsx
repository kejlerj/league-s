import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { Card, CardRow } from '../components/Card';
import { BackLink } from '../components/BackLink';
import { ThemedText } from '../components/ThemedText';
import { Crest } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useAppStore } from '../store/useAppStore';
import { listLeagues } from '../services/league';
import { fr } from '../i18n/fr';

export function LeaguePickerScreen() {
  const router = useRouter();
  const currentLeagueId = useAppStore((s) => s.leagueId);
  const setLeague = useAppStore((s) => s.setLeague);
  const leagues = useAsync(listLeagues, []);

  const choose = (leagueId: string) => {
    setLeague(leagueId);
    router.replace('/following');
  };

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-3">
          {currentLeagueId && <BackLink label={fr.leagues.back} />}
          <ThemedText weight="semibold" size={24}>{fr.leagues.title}</ThemedText>
          <ThemedText tone="muted" size={13}>{fr.leagues.hint}</ThemedText>
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-3.5 pb-6">
        {leagues.loading && <Skeleton rows={4} />}
        {leagues.error && <ErrorState message={fr.leagues.error} onRetry={leagues.reload} />}
        {leagues.data && leagues.data.length === 0 && !leagues.loading && (
          <ThemedText tone="muted" size={13.5}>{fr.leagues.empty}</ThemedText>
        )}

        {leagues.data && leagues.data.length > 0 && (
          <Card>
            {leagues.data.map((league, index) => (
              <Pressable
                key={league.id}
                testID={`league-row-${league.id}`}
                onPress={() => choose(league.id)}
                accessibilityRole="button"
              >
                <CardRow isFirst={index === 0}>
                  <Crest size={26} uri={league.logo} name={league.name} />
                  <ThemedText weight="medium" size={14.5} className="flex-1">{league.name}</ThemedText>
                  {league.id === currentLeagueId && (
                    <ThemedText testID={`league-current-${league.id}`} tone="accent" weight="semibold" size={14}>
                      ✓
                    </ThemedText>
                  )}
                </CardRow>
              </Pressable>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
