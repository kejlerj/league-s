import React from 'react';
import { Pressable, View } from 'react-native';
import { Card, CardRow } from './Card';
import { ThemedText } from './ThemedText';
import { Crest } from './Avatar';
import { fr } from '../i18n/fr';
import type { StandingRow } from '../types';

interface StandingsTableProps {
  rows: StandingRow[];
  highlightedTeamIds: string[];
  onPressTeam: (teamId: string) => void;
}

export function StandingsTable({ rows, highlightedTeamIds, onPressTeam }: StandingsTableProps) {
  return (
    <>
      <View className="flex-row items-center gap-3 px-1">
        <ThemedText tone="faint" mono size={10.5} style={{ width: 20 }}>{fr.standings.columnHeaders.rank}</ThemedText>
        <ThemedText tone="faint" mono size={10.5} className="flex-1">{fr.standings.columnHeaders.team}</ThemedText>
        <View style={{ width: 112 }} className="flex-row justify-between">
          <ThemedText tone="faint" mono size={10.5}>{fr.standings.columnHeaders.played}</ThemedText>
          <ThemedText tone="faint" mono size={10.5}>{fr.standings.columnHeaders.diff}</ThemedText>
          <ThemedText tone="faint" mono size={10.5}>{fr.standings.columnHeaders.pts}</ThemedText>
        </View>
      </View>
      <Card>
        {rows.map((row, index) => (
          <Pressable key={row.team_id} onPress={() => onPressTeam(row.team_id)}>
            <CardRow
              isFirst={index === 0}
              testID={`standings-row-${row.team_id}`}
              className={highlightedTeamIds.includes(row.team_id) ? 'bg-accent/5 dark:bg-accentDark/10' : undefined}
            >
              <ThemedText mono weight="semibold" size={14} style={{ width: 20 }}>{row.rank}</ThemedText>
              <Crest size={26} uri={row.team_logo} name={row.team_name} />
              <ThemedText weight="medium" size={14.5} className="flex-1">{row.team_name}</ThemedText>
              <View style={{ width: 112 }} className="flex-row justify-between">
                <ThemedText tone="muted" weight="medium" size={13.5}>{row.played}</ThemedText>
                <ThemedText tone="muted" weight="medium" size={13.5}>{row.goal_difference}</ThemedText>
                <ThemedText weight="semibold" size={13.5}>{row.points}</ThemedText>
              </View>
            </CardRow>
          </Pressable>
        ))}
      </Card>
    </>
  );
}
